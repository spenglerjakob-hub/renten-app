import React, { useState, useMemo } from 'react';
import { 
  Upload, FileText, TrendingUp, AlertCircle, Calculator, 
  CheckCircle, ChevronDown, ChevronUp, ShieldAlert, PiggyBank, 
  Briefcase, PlusCircle, Trash, Users, User, Info, Coins, Clock, Infinity as InfinityIcon, Wallet, Activity,
  LineChart as LineChartIcon, List, Download, Home
} from 'lucide-react';

// --- STEUER-ENGINE (EStG Formel Approximation verschoben auf 2026) ---
const calculateESt = (zve, isMarried) => {
  let x = isMarried ? zve / 2 : zve;
  x = Math.max(0, x - 744); 
  
  let tax = 0;
  if (x <= 11604) {
    tax = 0;
  } else if (x <= 17005) {
    const y = (x - 11604) / 10000;
    tax = (922.98 * y + 1400) * y;
  } else if (x <= 62809) {
    const z = (x - 17005) / 10000;
    tax = (208.91 * z + 2397) * z + 940.14;
  } else if (x <= 277825) {
    tax = 0.42 * x - 9972.98;
  } else {
    tax = 0.45 * x - 18307.73;
  }

  return isMarried ? tax * 2 : tax;
};

// --- Dynamische Ertragsanteils-Tabelle nach § 22 EStG ---
const getErtragsanteil = (age) => {
  const tabelle = {
    60: 0.22, 61: 0.22, 62: 0.21, 63: 0.20, 64: 0.19,
    65: 0.18, 66: 0.18, 67: 0.17, 68: 0.16, 69: 0.15,
    70: 0.15, 71: 0.14, 72: 0.14, 73: 0.13, 74: 0.13, 75: 0.12
  };
  if (age < 60) return 0.22; 
  if (age > 75) return 0.11; 
  return tabelle[age] || 0.17;
};

export default function App() {
  // --- STATE MANAGEMENT ---
  const [currentAge, setCurrentAge] = useState(35);
  const [retirementAge, setRetirementAge] = useState(67);
  const [targetIncomeToday, setTargetIncomeToday] = useState(2400); 
  const [hasChildren, setHasChildren] = useState(true);
  const [isMarried, setIsMarried] = useState(false); 
  const [showRealValue, setShowRealValue] = useState(false);
  const [hasChurchTax, setHasChurchTax] = useState(false);

  // Krankenversicherungs-Status
  const [kvStatus, setKvStatus] = useState('kvdr'); 
  const [pkvPremium, setPkvPremium] = useState(600);

  // Basis (GRV)
  const [grvGross, setGrvGross] = useState(0);
  const [grvIncreaseRate, setGrvIncreaseRate] = useState(1.5);

  // Lösungs-Rechner & Indexierung (Dropdowns 0 - 2%)
  const [inflationRate, setInflationRate] = useState(2.0);
  const [taxIndexRate, setTaxIndexRate] = useState(2.0);
  const [solutionSavingsReturn, setSolutionSavingsReturn] = useState(5.0);
  const [solutionSavingsDynamic, setSolutionSavingsDynamic] = useState(3.0);

  // Multi-Vertrags-Logik (inkl. multipler ETFs)
  const [contracts, setContracts] = useState([]);

  // UI States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('s1');
  const [expandedSections, setExpandedSections] = useState({ s1: true, s2: true, s3: true });
  const [rightView, setRightView] = useState('zusammensetzung'); 
  const [hoveredData, setHoveredData] = useState(null); 
  const [showTaxInfo, setShowTaxInfo] = useState(false); 

  const [planerCapital, setPlanerCapital] = useState(250000);
  const [planerWithdrawal, setPlanerWithdrawal] = useState(1000);
  const [planerReturn, setPlanerReturn] = useState(3.0);
  const [planerDynamic, setPlanerDynamic] = useState(2.0);
  const [includePlanerInNet, setIncludePlanerInNet] = useState(false);

  const toggleSection = (sec) => setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));

  const handleFileUpload = (e) => {
    e.preventDefault();
    if (isUploading) return;
    setIsUploading(true);
    
    setTimeout(() => {
      setGrvGross(1650);
      setKvStatus('kvdr');
      setHasChurchTax(true);
      setContracts([
        { id: 1, layer: 1, type: 'basis', name: 'Rürup Rente', gross: 300 },
        { id: 2, layer: 2, type: 'bav', name: 'bAV Direktversicherung', gross: 250 },
        { id: 6, layer: 2, type: 'bavKapital', name: 'bAV Kapitalauszahlung', gross: 50000, includeInNet: true },
        { id: 3, layer: 2, type: 'riester', name: 'Fonds-Riester', gross: 150 },
        { id: 4, layer: 3, type: 'prvRente', name: 'Private Rente Klassik', gross: 120 },
        { id: 5, layer: 3, type: 'prvKapital', name: 'Fonds-Police (Kapital)', gross: 45000, startYear: 2010, monthlyPremium: 100, dynamic: 5, includeInNet: true },
        { id: 7, layer: 3, type: 'immobilie', name: 'Eigentumswohnung', gross: 800, costs: 20, dynamic: 1.5, includeInNet: true },
        { id: 8, layer: 3, type: 'etf', name: 'Welt-ETF (Wachstum)', capital: 25000, monthly: 150, returnAcc: 6.0, returnWith: 3.5, ter: 0.2, withdrawalRate: 4.0, includeInNet: true }
      ]);
      setIncludePlanerInNet(false);
      setIsUploading(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }, 1500);
  };

  const addContract = (layer) => {
    const newId = Date.now();
    let defaultType = layer === 1 ? 'basis' : layer === 2 ? 'bav' : 'prvRente';
    let newContract = { id: newId, layer, type: defaultType, name: 'Neuer Vertrag', gross: 0 };
    if (defaultType === 'prvKapital') {
      newContract = { ...newContract, startYear: new Date().getFullYear() - 5, monthlyPremium: 100, dynamic: 3, includeInNet: true };
    }
    if (defaultType === 'bavKapital') {
      newContract = { ...newContract, includeInNet: true };
    }
    setContracts([...contracts, newContract]);
  };

  const updateContract = (id, field, value) => {
    setContracts(contracts.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleContractTypeChange = (id, newType) => {
    setContracts(contracts.map(c => {
        if (c.id === id) {
            let updates = { type: newType, gross: c.gross || 0 };
            if (newType === 'immobilie') {
                 updates.costs = 20;
                 updates.dynamic = 1.5;
            }
            if (newType === 'etf') {
                 updates.capital = 0; updates.monthly = 100; updates.returnAcc = 6.0; updates.returnWith = 3.0; updates.ter = 0.2; updates.withdrawalRate = 4.0; updates.includeInNet = true;
            }
            return { ...c, ...updates };
        }
        return c;
    }));
  };

  const removeContract = (id) => {
    setContracts(contracts.filter(c => c.id !== id));
  };

  // --- BERECHNUNGSLOGIK ---
  const calculations = useMemo(() => {
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const inflationFactor = Math.pow(1 + inflationRate / 100, yearsToRetirement);
    const targetIncomeFuture = targetIncomeToday * inflationFactor; 
    const retirementYear = new Date().getFullYear() + yearsToRetirement;

    const ertragsanteilRate = getErtragsanteil(retirementAge);
    const taxBasePercent = Math.min(1.0, 0.84 + (Math.max(0, retirementYear - 2026) * 0.005));
    const kistRate = hasChurchTax ? 0.08 : 0;
    
    const kvRateFull = 0.175; 
    const kvRateHalf = kvRateFull / 2; 
    const pvRateFull = hasChildren ? 0.036 : 0.042;
    
    const wageGrowthFactor = Math.pow(1 + taxIndexRate / 100, yearsToRetirement); 
    const bavFreibetragKV = 197.75 * wageGrowthFactor; 
    const BBG_KV = 5812.50 * wageGrowthFactor; 

    const grvFutureGross = grvGross * Math.pow(1 + grvIncreaseRate / 100, yearsToRetirement);
    const rentenFreibetrag = grvFutureGross * (1 - taxBasePercent); 
    let zvE_total = grvFutureGross - rentenFreibetrag;

    let deductible_kvpv = 0;
    let grvKvpv = 0;
    let remainingBBG = BBG_KV;

    if (kvStatus === 'pkv') {
      const grvSubsidy = Math.min(grvFutureGross, BBG_KV) * kvRateHalf; 
      grvKvpv = Math.max(0, pkvPremium - grvSubsidy); 
      deductible_kvpv = pkvPremium * 0.8; 
    } else if (kvStatus === 'kvdr') {
      const grvBeitragspflichtig = Math.min(grvFutureGross, BBG_KV);
      grvKvpv = grvBeitragspflichtig * (kvRateHalf + pvRateFull);
      deductible_kvpv += grvKvpv;
    } else if (kvStatus === 'freiwillig') {
      const grvBeitragspflichtig = Math.min(grvFutureGross, BBG_KV);
      grvKvpv = grvBeitragspflichtig * (kvRateHalf + pvRateFull);
      deductible_kvpv += grvKvpv;
      remainingBBG -= grvBeitragspflichtig;
    }

    const processedContracts = contracts.map(c => {
      let zvE_contribution = 0;
      let kvpv_deduction = 0;
      let incomeForKV = 0;

      if (c.type === 'basis') {
        const freibetragBasis = c.gross * (1 - taxBasePercent);
        zvE_contribution = c.gross - freibetragBasis; 
        if (kvStatus === 'freiwillig') incomeForKV = c.gross;
      } 
      else if (c.type === 'bav') {
        zvE_contribution = c.gross; 
        if (kvStatus === 'kvdr') {
          const bav_kv = Math.max(0, c.gross - bavFreibetragKV) * kvRateFull;
          const bav_pv = c.gross > bavFreibetragKV ? c.gross * pvRateFull : 0;
          kvpv_deduction = bav_kv + bav_pv;
          deductible_kvpv += kvpv_deduction;
        } else if (kvStatus === 'freiwillig') {
          incomeForKV = c.gross; 
        }
      }
      else if (c.type === 'riester') {
        zvE_contribution = c.gross; 
        if (kvStatus === 'freiwillig') incomeForKV = 0; 
      }
      else if (c.type === 'prvRente') {
        zvE_contribution = c.gross * ertragsanteilRate; 
        if (kvStatus === 'freiwillig') incomeForKV = c.gross; 
      }
      else if (c.type === 'immobilie') {
        const futureGross = c.gross * Math.pow(1 + (c.dynamic || 0) / 100, yearsToRetirement);
        const taxableRent = futureGross * (1 - (c.costs !== undefined ? c.costs : 20) / 100);
        c.futureGross = futureGross;
        c.taxableRent = taxableRent;
        zvE_contribution = taxableRent; 
        if (kvStatus === 'freiwillig') incomeForKV = taxableRent; 
      }
      else if (c.type === 'etf') {
        const netReturnAcc = Math.max(0, (c.returnAcc || 0) - (c.ter || 0));
        const r_monthly_acc = (netReturnAcc / 100) / 12;
        const months = yearsToRetirement * 12;
        const cap = (c.capital || 0) * Math.pow(1 + (netReturnAcc/100), yearsToRetirement) + ((c.monthly || 0) > 0 ? (c.monthly || 0) * ((Math.pow(1 + r_monthly_acc, months) - 1) / r_monthly_acc) : 0);
        const grossMonthly = (cap * ((c.withdrawalRate || 0) / 100)) / 12;
        c.totalCap = cap;
        c.grossMonthly = grossMonthly;
        if (kvStatus === 'freiwillig') incomeForKV = grossMonthly;
      }

      if (kvStatus === 'freiwillig' && incomeForKV > 0) {
        const anrechenbar = Math.min(incomeForKV, Math.max(0, remainingBBG));
        kvpv_deduction = anrechenbar * (kvRateFull + pvRateFull);
        remainingBBG -= anrechenbar;
        deductible_kvpv += kvpv_deduction;
      }

      zvE_total += zvE_contribution;
      return { ...c, zvE_contribution, kvpv_deduction };
    });

    const taxInflationFactor = wageGrowthFactor;
    const zvE_yearly_nominal = Math.max(0, zvE_total * 12 - (deductible_kvpv * 12));
    const zvE_yearly_today = zvE_yearly_nominal / taxInflationFactor;
    
    const tax_today = calculateESt(zvE_yearly_today, isMarried);
    const yearlyESt = tax_today * taxInflationFactor; 
    
    const avgTaxRate = zvE_yearly_nominal > 0 ? (yearlyESt / (zvE_total * 12)) : 0;
    const marginalTaxToday = (calculateESt(zvE_yearly_today + 100, isMarried) - tax_today) / 100;

    const grvESt = (grvFutureGross - rentenFreibetrag) * avgTaxRate;
    const grvKist = grvESt * kistRate;
    const grvNet = Math.max(0, grvFutureGross - grvKvpv - grvESt - grvKist);
    
    let s1_net = grvNet;
    let s2_net = 0;
    let s3_net = 0;

    const finalizedContracts = processedContracts.map(c => {
      let net = 0, tax = 0, kist = 0;
      if (c.type === 'basis') {
        tax = c.zvE_contribution * avgTaxRate;
        kist = tax * kistRate;
        net = c.gross - c.kvpv_deduction - tax - kist;
        s1_net += net;
      } 
      else if (c.type === 'bav' || c.type === 'riester') {
        tax = c.zvE_contribution * avgTaxRate;
        kist = tax * kistRate;
        net = c.gross - c.kvpv_deduction - tax - kist;
        s2_net += net;
      }
      else if (c.type === 'bavKapital') {
        const taxFuenftel_today = (calculateESt(zvE_yearly_today + (c.gross / inflationFactor / 5), isMarried) - tax_today) * 5;
        const taxFuenftel = taxFuenftel_today * inflationFactor;
        const kistFuenftel = taxFuenftel * kistRate;
        const monthlyBavGross = c.gross / 120;
        let monthlyKvPv = 0;
        if (kvStatus === 'kvdr') {
          const kv = Math.max(0, monthlyBavGross - bavFreibetragKV) * kvRateFull;
          const pv = monthlyBavGross > bavFreibetragKV ? monthlyBavGross * pvRateFull : 0;
          monthlyKvPv = kv + pv;
        } else if (kvStatus === 'freiwillig') {
          const anrechenbar = Math.min(monthlyBavGross, Math.max(0, remainingBBG));
          monthlyKvPv = anrechenbar * (kvRateFull + pvRateFull);
          remainingBBG -= anrechenbar;
        }
        tax = taxFuenftel; kist = kistFuenftel;
        c.kvpv_deduction = monthlyKvPv * 120;
        c.netCapital = Math.max(0, c.gross - tax - kist - c.kvpv_deduction);
        net = (c.netCapital * (withdrawalRate / 100)) / 12;
        if (c.includeInNet !== false) s2_net += net;
      }
      else if (c.type === 'prvRente') {
        tax = c.zvE_contribution * avgTaxRate;
        kist = tax * kistRate;
        net = c.gross - c.kvpv_deduction - tax - kist;
        s3_net += net;
      }
      else if (c.type === 'prvKapital') {
        let totalPremiums = 0;
        const years = Math.max(0, retirementYear - (c.startYear || 2010));
        let currPremium = (c.monthlyPremium || 0) * 12;
        for (let i = 0; i < years; i++) {
          totalPremiums += currPremium;
          currPremium *= (1 + (c.dynamic || 0) / 100);
        }
        const profit = Math.max(0, c.gross - totalPremiums);
        const taxHalb = profit * 0.5 * 0.85 * marginalTaxToday;
        const kistHalb = taxHalb * kistRate;
        const abgeltungRate = hasChurchTax ? 0.278186 : 0.26375;
        const taxAbgeltung = profit * 0.85 * abgeltungRate;
        if ((taxHalb + kistHalb) < taxAbgeltung) { tax = taxHalb; kist = kistHalb; c.appliedTaxMethod = 'Halbeinkünfte'; } 
        else { tax = taxAbgeltung; kist = 0; c.appliedTaxMethod = 'Abgeltungsteuer'; }
        
        let monthlyKvPv = 0;
        if (kvStatus === 'freiwillig') {
           const monthlyPrvGross = profit / 120;
           const anrechenbar = Math.min(monthlyPrvGross, Math.max(0, remainingBBG));
           monthlyKvPv = anrechenbar * (kvRateFull + pvRateFull);
           remainingBBG -= anrechenbar;
        }
        c.kvpv_deduction = monthlyKvPv * 120;
        c.netCapital = Math.max(0, c.gross - tax - kist - c.kvpv_deduction);
        net = (c.netCapital * (withdrawalRate / 100)) / 12;
        if (c.includeInNet !== false) s3_net += net;
      }
      else if (c.type === 'immobilie') {
        tax = c.taxableRent * avgTaxRate;
        kist = tax * kistRate;
        net = c.taxableRent - c.kvpv_deduction - tax - kist;
        if (c.includeInNet !== false) s3_net += net;
      }
      else if (c.type === 'etf') {
        tax = c.grossMonthly * 0.1145; 
        kist = hasChurchTax ? c.grossMonthly * 0.0055 : 0;
        net = c.grossMonthly - c.kvpv_deduction - tax - kist;
        if (c.includeInNet !== false) s3_net += net;
      }

      return { ...c, net, tax, kist };
    });

    if (includePlanerInNet) s3_net += planerWithdrawal;

    const gap = Math.max(0, targetIncomeFuture - (s1_net + s2_net + s3_net));
    const etfTotalCapital = finalizedContracts.filter(c => c.type === 'etf').reduce((s, c) => s + (c.totalCap || 0), 0);

    // Lösungsrechner
    const r_ret = (2.0 / 100) / 12;
    const n_ret = 25 * 12;
    let requiredCapital = gap > 0 ? (r_ret > 0 ? gap * (1 - Math.pow(1 + r_ret, -n_ret)) / r_ret : gap * n_ret) : 0;

    const dyn = solutionSavingsDynamic / 100;
    const r_m = (solutionSavingsReturn / 100) / 12;
    let requiredSavings = 0;
    if (requiredCapital > 0 && yearsToRetirement > 0) {
      if (r_m > 0) {
        if (dyn === 0) requiredSavings = requiredCapital * r_m / (Math.pow(1 + r_m, yearsToRetirement * 12) - 1);
        else {
          const r_a = Math.pow(1 + r_m, 12) - 1; 
          const C = (Math.pow(1 + r_m, 12) - 1) / r_m; 
          if (Math.abs(r_a - dyn) < 0.00001) requiredSavings = requiredCapital / (C * yearsToRetirement * Math.pow(1 + r_a, yearsToRetirement - 1));
          else requiredSavings = requiredCapital / (C * ((Math.pow(1 + r_a, yearsToRetirement) - Math.pow(1 + dyn, yearsToRetirement)) / (r_a - dyn)));
        }
      } else { 
        if (dyn === 0) requiredSavings = requiredCapital / (yearsToRetirement * 12);
        else requiredSavings = requiredCapital / (12 * ((Math.pow(1 + dyn, yearsToRetirement) - 1) / dyn));
      }
    }

    // Chart-Simulation für alle ETFs
    let etfSims = finalizedContracts.filter(c => c.type === 'etf' && c.includeInNet !== false).map(c => ({
        cap: c.totalCap,
        returnWithRate: Math.max(0, (c.returnWith || 0) - (c.ter || 0)),
        with: c.grossMonthly * 12
    }));

    const chartData = [];
    let curPlanerChart = Math.max(0, planerCapital), curPlanerWithChart = planerWithdrawal * 12;
    for (let age = retirementAge; age <= 100; age++) {
      let currentEtfTotal = etfSims.reduce((sum, sim) => sum + Math.max(0, sim.cap), 0);
      chartData.push({ age, etf: currentEtfTotal, planer: Math.max(0, curPlanerChart), discount: Math.pow(1 + inflationRate / 100, age - currentAge) });

      etfSims.forEach(sim => {
        if (sim.cap > 0) {
            sim.cap = sim.cap * (1 + sim.returnWithRate / 100) - sim.with;
            sim.with *= (1 + inflationRate / 100);
        }
      });

      if (curPlanerChart > 0) curPlanerChart = curPlanerChart * (1 + planerReturn / 100) - curPlanerWithChart;
      curPlanerWithChart *= (1 + planerDynamic / 100);
    }

    return {
      yearsToRetirement, targetIncomeFuture, targetIncomeToday, retirementYear,
      inflationFactor, taxInflationFactor, chartData, zvE_yearly: zvE_yearly_nominal, yearlyESt, avgTaxRate, marginalTaxRate: marginalTaxToday, deductible_kvpv, rentenFreibetrag, ertragsanteilRate, kistRate,
      grvFutureGross, grvNet, grvKvpv, grvESt, grvKist, s1_net, s2_net, s3_net, contracts: finalizedContracts, etfTotalCapital,
      totalNetFuture: s1_net + s2_net + s3_net, gap, requiredCapital, requiredSavings
    };
  }, [
    currentAge, retirementAge, targetIncomeToday, hasChildren, isMarried, kvStatus, pkvPremium, hasChurchTax,
    grvGross, grvIncreaseRate, contracts, planerCapital, planerWithdrawal, planerReturn, planerDynamic, includePlanerInNet,
    inflationRate, taxIndexRate, solutionSavingsReturn, solutionSavingsDynamic
  ]);

  const planerCalculations = useMemo(() => {
    const nettoVerrentungsKapital = Math.max(0, planerCapital);
    let currentCap = nettoVerrentungsKapital, currentWith = planerWithdrawal * 12, yearsLasted = 0;
    if (nettoVerrentungsKapital > 0 && planerWithdrawal > 0) {
      for (let i = 0; i < 100; i++) {
        currentCap = currentCap * (1 + planerReturn / 100) - currentWith;
        if (currentCap <= 0) break;
        currentWith *= (1 + planerDynamic / 100);
        yearsLasted++;
      }
    }
    return { nettoVerrentungsKapital, yearsLasted, runOutAge: retirementAge + yearsLasted, lastsForever: yearsLasted >= 99 };
  }, [planerCapital, planerWithdrawal, planerReturn, planerDynamic, retirementAge]);

  const handleLoadPlaner = () => {
    const etf = calculations.etfTotalCapital || 0;
    const prv = calculations.contracts.filter(c => c.type === 'prvKapital' || c.type === 'bavKapital').reduce((s, c) => s + (c.netCapital || 0), 0);
    setPlanerCapital(Math.round(etf + prv));
    setContracts(prev => prev.map(c => (c.type === 'prvKapital' || c.type === 'bavKapital' || c.type === 'etf') ? { ...c, includeInNet: false } : c));
  };

  const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  const formatResultCurrency = (val) => formatCurrency(showRealValue ? val / calculations.inflationFactor : val);
  const formatChartCurrency = (val, discount) => formatCurrency(showRealValue ? val / discount : val);
  const formatYAxis = (val) => val >= 1000000 ? (val / 1000000).toFixed(1).replace('.0', '') + ' Mio.' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toString();

  // Helper für den PDF-Druck (Kassenbon): Zeigt Nominal + Real gleichzeitig an!
  const renderBonVal = (val) => (
    <>
      <span className="print:hidden">{formatResultCurrency(val)}</span>
      <span className="hidden print:inline">{formatCurrency(val)} <span className="text-slate-500 font-normal">({formatCurrency(val / calculations.inflationFactor)} real)</span></span>
    </>
  );

  // --- SVG CHART RENDER HELPERS ---
  const svgWidth = 800;
  const svgHeight = 350;
  const paddingX = 40;
  const paddingY = 20;
  const bottomPadding = 40;
  const graphHeight = svgHeight - paddingY - bottomPadding;

  const maxDataVal = Math.max(...calculations.chartData.map(d => {
    const vEtf = showRealValue ? d.etf / d.discount : d.etf;
    const vPlaner = showRealValue ? d.planer / d.discount : d.planer;
    return Math.max(vEtf, vPlaner);
  }));
  const maxY = Math.max(100, maxDataVal * 1.1); 

  const getX = (index) => paddingX + (index / (Math.max(1, calculations.chartData.length - 1))) * (svgWidth - paddingX * 2);
  const getY = (val) => svgHeight - bottomPadding - (val / maxY) * graphHeight;

  const etfPath = calculations.chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(showRealValue ? d.etf / d.discount : d.etf)}`).join(" ");
  const planerPath = calculations.chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(showRealValue ? d.planer / d.discount : d.planer)}`).join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(mult => maxY * mult);

  const renderContractInput = (c) => (
    <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm relative group mb-3">
      <button onClick={() => removeContract(c.id)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 transition-colors"><Trash className="w-4 h-4" /></button>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 pr-6">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Vertragsart</label>
          <select value={c.type} onChange={e => handleContractTypeChange(c.id, e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50 focus:bg-white">
            {c.layer === 1 && <option value="basis">Rürup / Basisrente</option>}
            {c.layer === 2 && <><option value="bav">bAV (Rente)</option><option value="bavKapital">bAV (Kapital)</option><option value="riester">Riester-Rente</option></>}
            {c.layer === 3 && <><option value="prvRente">Private Rente (monatlich)</option><option value="prvKapital">Private Rente (Kapitalauszahlung)</option><option value="immobilie">Vermietung (Immobilie)</option><option value="etf">Freies Depot (ETF / Aktien)</option></>}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Bezeichnung</label>
          <input type="text" value={c.name} onChange={e => updateContract(c.id, 'name', e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" placeholder="z.B. Allianz" />
        </div>
      </div>
      
      {c.type !== 'immobilie' && c.type !== 'etf' && (
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{c.type.includes('Kapital') ? 'Kapitalauszahlung (€ Brutto)' : 'Rente (€/Monat Brutto)'}</label>
          <input type="number" value={c.gross || ''} onChange={e => updateContract(c.id, 'gross', Number(e.target.value))} className="w-full border border-slate-300 rounded p-2 text-sm font-semibold" />
        </div>
      )}

      {c.type === 'immobilie' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
          <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Kaltmiete (€/M)</label><input type="number" value={c.gross || ''} onChange={e => updateContract(c.id, 'gross', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold" /></div>
          <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Instandhaltung (%)</label><input type="number" step="1" value={c.costs !== undefined ? c.costs : 20} onChange={e => updateContract(c.id, 'costs', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
          <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Miet-Dyn. p.a. (%)</label><input type="number" step="0.1" value={c.dynamic !== undefined ? c.dynamic : 1.5} onChange={e => updateContract(c.id, 'dynamic', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
        </div>
      )}

      {c.type === 'etf' && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Kapital heute (€)</label><input type="number" value={c.capital || ''} onChange={e => updateContract(c.id, 'capital', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Sparrate (€/M)</label><input type="number" value={c.monthly || ''} onChange={e => updateContract(c.id, 'monthly', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold" /></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Rend. Ansp.</label><input type="number" step="0.1" value={c.returnAcc !== undefined ? c.returnAcc : 6} onChange={e => updateContract(c.id, 'returnAcc', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Rend. Entn.</label><input type="number" step="0.1" value={c.returnWith !== undefined ? c.returnWith : 3} onChange={e => updateContract(c.id, 'returnWith', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">TER (%)</label><input type="number" step="0.1" value={c.ter !== undefined ? c.ter : 0.2} onChange={e => updateContract(c.id, 'ter', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Entnahme %</label><input type="number" step="0.1" value={c.withdrawalRate !== undefined ? c.withdrawalRate : 4} onChange={e => updateContract(c.id, 'withdrawalRate', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={c.includeInNet !== false} onChange={e => updateContract(c.id, 'includeInNet', e.target.checked)} className="rounded text-emerald-600 w-3 h-3" />
            <label className="text-[10px] text-slate-600 font-medium cursor-pointer" onClick={() => updateContract(c.id, 'includeInNet', c.includeInNet === false)}>Entnahme ins Gesamt-Netto einrechnen</label>
          </div>
        </div>
      )}

      {(c.type === 'prvKapital' || c.type === 'bavKapital') && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          {c.type === 'prvKapital' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Beginn (J)</label><input type="number" value={c.startYear || ''} onChange={e => updateContract(c.id, 'startYear', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Beitrag (€)</label><input type="number" value={c.monthlyPremium || ''} onChange={e => updateContract(c.id, 'monthlyPremium', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Dyn. (%)</label><input type="number" step="0.1" value={c.dynamic || ''} onChange={e => updateContract(c.id, 'dynamic', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={c.includeInNet !== false} onChange={e => updateContract(c.id, 'includeInNet', e.target.checked)} className="rounded text-emerald-600 w-3 h-3" />
            <label className="text-[10px] text-slate-600 font-medium cursor-pointer" onClick={() => updateContract(c.id, 'includeInNet', c.includeInNet === false)}>In mtl. Rente umwandeln & ins Gesamt-Netto einrechnen</label>
          </div>
        </div>
      )}

      {c.type === 'immobilie' && (
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-3">
          <input type="checkbox" checked={c.includeInNet !== false} onChange={e => updateContract(c.id, 'includeInNet', e.target.checked)} className="rounded text-emerald-600 w-3 h-3" />
          <label className="text-[10px] text-slate-600 font-medium cursor-pointer" onClick={() => updateContract(c.id, 'includeInNet', c.includeInNet === false)}>In Gesamt-Netto übernehmen</label>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-28 print:bg-white print:pb-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      <header className="sticky top-0 z-50 bg-slate-900 text-white p-4 sm:p-6 shadow-md print:bg-slate-900 print:static">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <ShieldAlert className="w-8 h-8 text-emerald-400 shrink-0" />
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold">Vorsorge-Analyzer Pro</h1>
              <p className="text-slate-400 text-xs sm:text-sm">Präzisions-Engine 2026 inkl. Indexierung & KiSt</p>
            </div>
          </div>
          <div className="flex bg-slate-800 p-1.5 rounded-lg border border-slate-700 gap-1.5 flex-wrap justify-center sm:justify-end print:hidden w-full sm:w-auto">
            <button onClick={() => setShowRealValue(!showRealValue)} className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-all ${showRealValue ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Coins className="w-3 h-3 sm:w-4 sm:h-4" /> Kaufkraft heute</button>
            <div className="w-px bg-slate-700 mx-0.5 sm:mx-1 hidden sm:block"></div>
            
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-all bg-emerald-600 text-white shadow hover:bg-emerald-500">
              <Coins className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Inflation:</span>
              <select value={inflationRate} onChange={e => setInflationRate(Number(e.target.value))} className="bg-transparent font-bold outline-none cursor-pointer text-center appearance-none">
                {[0, 0.5, 1.0, 1.5, 2.0].map(v => <option key={v} value={v} className="text-slate-900">{v.toFixed(1).replace('.', ',')} %</option>)}
              </select>
            </div>
            <div className="w-px bg-slate-700 mx-0.5 sm:mx-1 hidden sm:block"></div>
            
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-all bg-indigo-600 text-white shadow hover:bg-indigo-500">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Indexierung:</span>
              <select value={taxIndexRate} onChange={e => setTaxIndexRate(Number(e.target.value))} className="bg-transparent font-bold outline-none cursor-pointer text-center appearance-none">
                {[0, 0.5, 1.0, 1.5, 2.0].map(v => <option key={v} value={v} className="text-slate-900">{v.toFixed(1).replace('.', ',')} %</option>)}
              </select>
            </div>
            <div className="w-px bg-slate-700 mx-0.5 sm:mx-1 hidden sm:block"></div>

            <button onClick={() => setIsMarried(false)} className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-all ${!isMarried ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><User className="w-3 h-3 sm:w-4 sm:h-4" /> Single</button>
            <button onClick={() => setIsMarried(true)} className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-all ${isMarried ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Users className="w-3 h-3 sm:w-4 sm:h-4" /> Verheiratet</button>
            <div className="w-px bg-slate-700 mx-0.5 sm:mx-1 hidden sm:block"></div>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-bold bg-rose-600 text-white shadow hover:bg-rose-500 transition-all"><Download className="w-3 h-3 sm:w-4 sm:h-4" /> PDF Report</button>
          </div>
        </div>
      </header>

      <div className="hidden print:block max-w-6xl mx-auto p-6 text-center border-b-2 border-slate-200 mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-widest">Persönliches Vorsorge-Gutachten</h2>
        <p className="text-slate-500 mt-2">Berechnet unter Berücksichtigung der Inflations-Tarif-Indexierung</p>
      </div>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 print:p-0 print:block">
        
        {/* --- NEU: EINGABEDATEN FÜR DEN PDF-DRUCK --- */}
        <div className="hidden print:block lg:col-span-12 mb-8 break-inside-avoid">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-2 mb-4 text-slate-800">1. Ihre Eingabedaten & Prämissen</h2>
          <div className="grid grid-cols-2 gap-4 text-sm mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div><strong>Alter heute:</strong> {currentAge} Jahre</div>
            <div><strong>Renteneintritt:</strong> {retirementAge} Jahre (im Jahr {calculations.retirementYear})</div>
            <div><strong>Zielbedarf (Netto):</strong> {formatCurrency(targetIncomeToday)} (in Kaufkraft heute)</div>
            <div><strong>Steuer-Status:</strong> {isMarried ? 'Zusammenveranlagung (Splitting)' : 'Grundtarif (Single)'} {hasChurchTax ? '+ KiSt' : ''}</div>
            <div><strong>KV-Status im Alter:</strong> {kvStatus === 'kvdr' ? 'KVdR (Pflichtversichert)' : kvStatus === 'freiwillig' ? 'Freiwillig GKV (KV/PV auf alle Einkünfte)' : 'Privat (PKV)'}</div>
            <div><strong>Inflation (angenommen):</strong> {inflationRate.toFixed(1).replace('.', ',')} % p.a.</div>
            <div><strong>Tarif-Indexierung:</strong> {taxIndexRate.toFixed(1).replace('.', ',')} % p.a.</div>
          </div>

          <h3 className="font-bold text-slate-800 mb-2">Gesetzliche Basis (Schicht 1)</h3>
          <ul className="text-sm list-disc pl-5 mb-6 text-slate-600">
             <li>Brutto-Anspruch heute: <strong>{formatCurrency(grvGross)} / Monat</strong> (Dynamik: {grvIncreaseRate}% p.a.)</li>
          </ul>

          <h3 className="font-bold text-slate-800 mb-2">Ihre Zusatz-Verträge & Depots</h3>
          <table className="w-full text-sm text-left border-collapse mb-4 border border-slate-200">
             <thead className="bg-slate-100">
               <tr>
                 <th className="py-2 px-3 border-b border-slate-300">Schicht</th>
                 <th className="py-2 px-3 border-b border-slate-300">Art</th>
                 <th className="py-2 px-3 border-b border-slate-300">Name</th>
                 <th className="py-2 px-3 border-b border-slate-300">Wert / Beitrag</th>
               </tr>
             </thead>
             <tbody>
               {contracts.length === 0 && <tr><td colSpan="4" className="py-3 px-3 text-center text-slate-500 italic">Keine Zusatzverträge erfasst.</td></tr>}
               {contracts.map(c => (
                 <tr key={c.id} className="border-b border-slate-100">
                   <td className="py-2 px-3">Schicht {c.layer}</td>
                   <td className="py-2 px-3">{c.type.toUpperCase()}</td>
                   <td className="py-2 px-3 font-semibold">{c.name}</td>
                   <td className="py-2 px-3">
                     {c.type === 'etf' ? `Kapital heute: ${formatCurrency(c.capital)} | Sparrate: ${formatCurrency(c.monthly)}/M` :
                      c.type.includes('Kapital') ? `Ablaufleistung: ${formatCurrency(c.gross)} Brutto` :
                      c.type === 'immobilie' ? `Kaltmiete: ${formatCurrency(c.gross)}/M` :
                      `Garantierente: ${formatCurrency(c.gross)}/M Brutto`}
                   </td>
                 </tr>
               ))}
             </tbody>
          </table>
        </div>

        <div className="lg:col-span-6 xl:col-span-5 space-y-6 print:hidden">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
            <h2 className="text-sm font-bold mb-4 text-slate-700 border-b border-slate-100 pb-2">Daten & Status</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-xs font-semibold text-slate-500 mb-1">Alter</label><input type="number" value={currentAge} onChange={e => setCurrentAge(Number(e.target.value))} className="w-full border rounded p-2" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 mb-1">Renteneintritt</label><input type="number" value={retirementAge} onChange={e => setRetirementAge(Number(e.target.value))} className="w-full border rounded p-2" /></div>
            </div>
            <div className="mb-4">
              <label className="block text-[10px] sm:text-xs font-semibold text-indigo-600 mb-1">Gewünschtes Netto im Alter (Kaufkraft heute in €)</label>
              <input type="number" value={targetIncomeToday} onChange={e => setTargetIncomeToday(Number(e.target.value))} className="w-full border border-indigo-200 bg-indigo-50/50 rounded p-2 font-bold text-indigo-900" />
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> Krankenversicherung im Alter</label>
                <select value={kvStatus} onChange={e => setKvStatus(e.target.value)} className="w-full border rounded p-2 text-sm">
                  <option value="kvdr">Gesetzlich (KVdR - Pflichtversichert)</option>
                  <option value="freiwillig">Gesetzlich (Freiwillig versichert)</option>
                  <option value="pkv">Privat versichert (PKV)</option>
                </select>
              </div>
              {kvStatus === 'pkv' && <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Erwarteter PKV-Beitrag (€/M)</label><input type="number" value={pkvPremium} onChange={e => setPkvPremium(Number(e.target.value))} className="w-full border rounded p-2 text-sm" /></div>}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2"><input type="checkbox" checked={hasChildren} onChange={e => setHasChildren(e.target.checked)} className="rounded" /><label className="text-xs text-slate-600">Kinder vorhanden (PV-Zuschlag entfällt)</label></div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={hasChurchTax} onChange={e => setHasChurchTax(e.target.checked)} className="rounded text-indigo-600" /><label className="text-xs text-slate-600">Kirchensteuer berechnen (8 %)</label></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50">
              {['s1', 's2', 's3', 'planer'].map(t => (
                <button key={t} className={`flex-1 py-3 px-2 whitespace-nowrap text-[10px] sm:text-xs font-bold uppercase tracking-wider ${activeTab === t ? 'bg-white text-indigo-700 border-b-2 border-indigo-700' : 'text-slate-500'}`} onClick={() => setActiveTab(t)}>{t === 's1' ? 'Schicht 1' : t === 's2' ? 'Schicht 2' : t === 's3' ? 'Schicht 3' : 'Planer'}</button>
              ))}
            </div>
            <div className="p-4 sm:p-5 bg-slate-50/50 min-h-[400px]">
              {activeTab === 's1' && (
                <div className="space-y-5">
                  <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Gesetzliche Rente</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Anspruch (€)</label><input type="number" value={grvGross} onChange={e => setGrvGross(Number(e.target.value))} className="w-full border rounded p-2" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Dynamik (%)</label><input type="number" step="0.1" value={grvIncreaseRate} onChange={e => setGrvIncreaseRate(Number(e.target.value))} className="w-full border rounded p-2" /></div>
                    </div>
                  </div>
                  {contracts.filter(c => c.layer === 1).map(renderContractInput)}
                  <button onClick={() => addContract(1)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 transition-colors hover:border-blue-400 hover:text-blue-600"><PlusCircle className="w-4 h-4" /> Rürup hinzufügen</button>
                </div>
              )}
              {activeTab === 's2' && (
                <div className="space-y-5">
                  <div className="bg-purple-50 p-3 rounded text-[10px] text-purple-800 border border-purple-100 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>bAV unterliegt voll der KV/PV (inkl. Freibetrag), Riester ist KV/PV-frei. Kapitalauszahlungen werden über 120 Monate umgelegt.</span></div>
                  {contracts.filter(c => c.layer === 2).map(renderContractInput)}
                  <button onClick={() => addContract(2)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 transition-colors hover:border-purple-400 hover:text-purple-600"><PlusCircle className="w-4 h-4" /> bAV / Riester hinzufügen</button>
                </div>
              )}
              {activeTab === 's3' && (
                <div className="space-y-6">
                  {contracts.filter(c => c.layer === 3).map(renderContractInput)}
                  <button onClick={() => addContract(3)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 transition-colors hover:border-emerald-400 hover:text-emerald-600"><PlusCircle className="w-4 h-4" /> Privat / Depot / Immo hinzufügen</button>
                </div>
              )}
              {activeTab === 'planer' && (
                <div className="space-y-6">
                  <div className="bg-indigo-50 p-4 sm:p-5 rounded-xl border border-indigo-200 shadow-sm">
                    <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2"><Wallet className="w-5 h-5 text-indigo-600" /> Entnahmeplaner</h3>
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm space-y-4">
                        <div><div className="flex justify-between items-end mb-1"><label className="block text-xs font-semibold text-slate-600">Start-Kapital (€)</label><button onClick={handleLoadPlaner} className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Daten laden</button></div><input type="number" value={planerCapital} onChange={e => setPlanerCapital(Number(e.target.value))} className="w-full border rounded p-2 bg-slate-50" /></div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Entn. mtl.</label><input type="number" value={planerWithdrawal} onChange={e => setPlanerWithdrawal(Number(e.target.value))} className="w-full border rounded p-2 text-sm" /></div>
                          <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Rendite %</label><input type="number" step="0.1" value={planerReturn} onChange={e => setPlanerReturn(Number(e.target.value))} className="w-full border rounded p-2 text-sm" /></div>
                          <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Dyn. %</label><input type="number" step="0.1" value={planerDynamic} onChange={e => setPlanerDynamic(Number(e.target.value))} className="w-full border rounded p-2 text-sm" /></div>
                        </div>
                        <div className="flex items-center gap-2 pt-3 border-t"><input type="checkbox" checked={includePlanerInNet} onChange={e => setIncludePlanerInNet(e.target.checked)} className="rounded" /><label className="text-[10px] text-indigo-800 font-medium">In Gesamt-Netto übernehmen</label></div>
                      </div>
                      <div className="bg-indigo-900 rounded-lg p-4 sm:p-5 text-white flex justify-between">
                        <div><div className="text-xs text-indigo-300 mb-1">Reicht für:</div><div className="font-bold text-lg text-emerald-400">{planerCalculations.lastsForever ? 'Unbegrenzt' : `${planerCalculations.yearsLasted} J.`}</div></div>
                        <div className="text-right"><div className="text-xs text-indigo-300 mb-1">Leer mit:</div><div className="font-bold text-lg text-rose-300">{planerCalculations.lastsForever ? '-' : `Alter ${planerCalculations.runOutAge}`}</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-5 bg-white border-t"><button onClick={handleFileUpload} disabled={isUploading} className="w-full border border-dashed rounded p-3 text-sm font-medium bg-blue-50/50 text-blue-700 border-blue-200">{isUploading ? 'Lade...' : 'Demo-Daten laden'}</button></div>
          </div>
        </div>

        <div className="lg:col-span-6 xl:col-span-7 space-y-6 print:col-span-12">
          
          <div className="hidden print:block mb-8 border-b border-slate-300 pb-2">
            <h2 className="text-lg font-bold text-slate-800">2. Ergebnis: Ihr Kassenbon im Rentenalter</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-500 mb-1">Zielbedarf (Netto) im Jahr {calculations.retirementYear}</h3>
              <div className="text-2xl sm:text-3xl font-bold">
                 <span className="print:hidden">{formatResultCurrency(calculations.targetIncomeFuture)}</span>
                 <span className="hidden print:inline">{formatCurrency(calculations.targetIncomeFuture)} <span className="text-base text-slate-500 font-normal">({formatCurrency(calculations.targetIncomeToday)} real)</span></span>
              </div>
            </div>
            <div className={`bg-white rounded-xl shadow-sm border p-4 sm:p-6 ${calculations.gap > 0 ? 'border-rose-200 text-rose-600' : 'border-emerald-200 text-emerald-600'}`}>
              <h3 className="text-sm font-semibold mb-1">Rentenlücke</h3>
              <div className="text-2xl sm:text-3xl font-bold">
                {calculations.gap > 0 ? (
                  <>
                    <span className="print:hidden">{formatResultCurrency(calculations.gap)}</span>
                    <span className="hidden print:inline">{formatCurrency(calculations.gap)} <span className="text-base font-normal">({formatCurrency(calculations.gap / calculations.inflationFactor)} real)</span></span>
                  </>
                ) : 'Gedeckt'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden print:bg-slate-100 print:text-slate-800 print:border-slate-300">
            <div className="p-4 sm:p-5 flex justify-between items-center cursor-pointer hover:bg-slate-800/50 transition-colors print:bg-white" onClick={() => setShowTaxInfo(!showTaxInfo)}>
              <div className="flex items-center gap-3">
                <Calculator className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <h3 className="font-bold text-white print:text-slate-800 m-0 text-sm sm:text-base">Steuer-Engine 2026 {taxIndexRate > 0 ? `(Indexiert mit ${taxIndexRate.toFixed(1).replace('.', ',')} %)` : '(Status Quo / 0 %)'}</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 m-0 print:text-slate-500 mt-0.5">Klicken für steuerliche Annahmen & Erklärungen</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-[9px] sm:text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300 print:border print:bg-slate-100 print:text-slate-600 hidden sm:block">{isMarried?'Splitting':'Single'} {hasChurchTax && '+ KiSt'}</div>
                {showTaxInfo ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </div>
            </div>
            
            <div className="px-4 sm:px-5 pb-4 sm:pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm sm:divide-x divide-slate-700 bg-slate-800/40 p-4 rounded-lg print:bg-slate-50 print:border print:divide-slate-200">
                {[['Zu versteuern', formatCurrency(calculations.zvE_yearly)], ['Ø-Steuersatz', `${(calculations.avgTaxRate * 100).toFixed(1)}%`], ['Grenzsteuer', `${(calculations.marginalTaxRate * 100).toFixed(1)}%`], ['Absetzb. KV', formatCurrency(calculations.deductible_kvpv * 12)]].map(([l, v]) => (
                  <div key={l} className="sm:pl-4 first:pl-0"><div className="text-[10px] sm:text-xs text-slate-400 mb-1 print:text-slate-500">{l}</div><div className="font-mono text-white print:text-slate-800 font-bold">{v}</div></div>
                ))}
              </div>
            </div>

            {showTaxInfo && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 border-t border-slate-800 print:border-slate-300 mt-2">
                <p className="text-[11px] sm:text-xs text-slate-300 print:text-slate-600 mb-4 leading-relaxed">
                  {taxIndexRate > 0 ? (
                    <><strong className="text-indigo-400 print:text-indigo-600">Warum zahlt man scheinbar so wenig Steuern?</strong> Das deutsche Steuersystem darf Sie in der Zukunft nicht durch die sogenannte <em className="italic">"Kalte Progression"</em> künstlich reich rechnen. Daher indexiert unsere Engine (wie vom Gesetzgeber vorgegeben) die steuerlichen Freibeträge und Abgabengrenzen jedes Jahr mit der erwarteten Anpassung ({taxIndexRate.toFixed(1).replace('.', ',')} % p.a.). Sie werden steuerlich also so fair behandelt wie ein heutiger Rentner mit gleicher Kaufkraft.</>
                  ) : (
                    <><strong className="text-rose-400 print:text-rose-600">Achtung: Status Quo Ansicht!</strong> Sie haben die Tarif-Indexierung auf 0,0 % gesetzt. Die App rechnet Ihr zukünftiges Einkommen nun knallhart gegen die heutigen Steuerfreibeträge (Kalte Progression). Das führt in der Zukunftssimulation zu überproportional (und unrealistisch) hohen Steuerlasten, da Inflationsausgleiche des Staates ignoriert werden.</>
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-slate-800/40 p-3 sm:p-4 rounded-lg print:bg-white print:border">
                    <h4 className="font-bold text-slate-200 print:text-slate-800 text-xs mb-3 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div> Grundfreibetrag (ESt)</h4>
                    <ul className="space-y-2 text-[10px] sm:text-xs">
                      <li className="flex justify-between items-center text-slate-400 print:text-slate-600"><span>Heute (2026):</span> <span>{formatCurrency(isMarried ? 24696 : 12348)}</span></li>
                      <li className="flex justify-between items-center text-indigo-300 print:text-indigo-700 font-bold"><span>Rentenstart ({calculations.retirementYear}):</span> <span>{formatCurrency((isMarried ? 24696 : 12348) * calculations.taxInflationFactor)}</span></li>
                    </ul>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 print:text-slate-500 mt-3 pt-3 border-t border-slate-700 print:border-slate-200">
                      Ihr simuliertes zu versteuerndes Einkommen wird intern auf die heutige Kaufkraft heruntergerechnet, daraufhin wird der heutige Steuersatz ermittelt.
                    </p>
                  </div>

                  <div className="bg-slate-800/40 p-3 sm:p-4 rounded-lg print:bg-white print:border">
                    <h4 className="font-bold text-slate-200 print:text-slate-800 text-xs mb-3 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Bemessungsgrenze (KV/PV)</h4>
                    <ul className="space-y-2 text-[10px] sm:text-xs">
                      <li className="flex justify-between items-center text-slate-400 print:text-slate-600"><span>Heute (2026):</span> <span>5.812 € / Monat</span></li>
                      <li className="flex justify-between items-center text-emerald-300 print:text-emerald-700 font-bold"><span>Rentenstart ({calculations.retirementYear}):</span> <span>{formatCurrency(5812.50 * calculations.taxInflationFactor)} / M.</span></li>
                    </ul>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 print:text-slate-500 mt-3 pt-3 border-t border-slate-700 print:border-slate-200">
                      Auch die Grenzen für Sozialabgaben (KV/PV) wachsen jährlich mit der Lohnentwicklung (ca. {taxIndexRate.toFixed(1).replace('.', ',')} % p.a.) mit.
                    </p>
                  </div>

                  <div className="bg-slate-800/40 p-3 sm:p-4 rounded-lg print:bg-white print:border">
                    <h4 className="font-bold text-slate-200 print:text-slate-800 text-xs mb-3 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div> bAV Freibetrag (KV/PV)</h4>
                    <ul className="space-y-2 text-[10px] sm:text-xs">
                      <li className="flex justify-between items-center text-slate-400 print:text-slate-600"><span>Heute (2026):</span> <span>{formatCurrency(197.75)} / Monat</span></li>
                      <li className="flex justify-between items-center text-purple-300 print:text-purple-700 font-bold"><span>Rentenstart ({calculations.retirementYear}):</span> <span>{formatCurrency(197.75 * calculations.taxInflationFactor)} / M.</span></li>
                    </ul>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 print:text-slate-500 mt-3 pt-3 border-t border-slate-700 print:border-slate-200">
                      Der Freibetrag für Betriebsrenten (bAV) ist an die Bezugsgröße gekoppelt und wächst ebenfalls künftig mit, um Sie real vor Abgaben zu schützen.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex bg-slate-200/50 p-1 rounded border mb-4 print:hidden">
            <button onClick={() => setRightView('zusammensetzung')} className={`flex-1 py-2 rounded text-[10px] sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 ${rightView === 'zusammensetzung' ? 'bg-white shadow' : 'text-slate-500'}`}><List className="w-3 h-3 sm:w-4 sm:h-4" /> Kassenbon</button>
            <button onClick={() => setRightView('verlauf')} className={`flex-1 py-2 rounded text-[10px] sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 ${rightView === 'verlauf' ? 'bg-white shadow' : 'text-slate-500'}`}><LineChartIcon className="w-3 h-3 sm:w-4 sm:h-4" /> Verlauf</button>
          </div>

          <div className={`bg-white rounded-xl shadow-sm border p-4 sm:p-6 print:block print:break-inside-avoid ${rightView === 'zusammensetzung' ? 'block' : 'hidden'}`}>
            <h2 className="text-sm font-bold mb-4 print:hidden">Zusammensetzung Ihres Netto-Einkommens im Jahr {calculations.retirementYear}</h2>
            
            <div className="mb-6">
              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-2">
                <span>0 €</span><span>Bedarf: {formatResultCurrency(calculations.targetIncomeFuture)}</span>
              </div>
              <div className="h-6 bg-slate-100 rounded-full overflow-hidden flex relative w-full border border-slate-200 print:border-slate-300">
                {calculations.targetIncomeFuture > 0 && (
                  <>
                    <div className="bg-blue-500 h-full transition-all" style={{ width: `${Math.min(100, (calculations.s1_net / calculations.targetIncomeFuture) * 100)}%` }}></div>
                    <div className="bg-purple-500 h-full transition-all border-l border-white/20" style={{ width: `${Math.min(100, (calculations.s2_net / calculations.targetIncomeFuture) * 100)}%` }}></div>
                    <div className="bg-emerald-500 h-full transition-all border-l border-white/20" style={{ width: `${Math.min(100, (calculations.s3_net / calculations.targetIncomeFuture) * 100)}%` }}></div>
                  </>
                )}
                <div className="absolute top-0 bottom-0 w-[2px] bg-slate-800 z-10" style={{ left: '100%' }}></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="border border-blue-100 rounded-lg overflow-hidden print:border-slate-300 print:break-inside-avoid">
                <div className="flex items-center justify-between p-3 bg-blue-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s1')}>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 print:bg-slate-800"></div><span className="font-bold text-sm text-blue-900 print:text-slate-800">Schicht 1 (Basis)</span></div>
                  <div className="flex items-center gap-3"><span className="font-bold text-sm sm:text-base">{renderBonVal(calculations.s1_net)}</span><ChevronDown className={`w-4 h-4 text-slate-400 print:hidden transition-transform ${expandedSections.s1 ? 'rotate-180' : ''}`} /></div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-blue-100 space-y-2 print:border-slate-300 ${expandedSections.s1 ? 'block' : 'hidden'} print:block`}>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0 bg-slate-50 p-2 rounded print:border print:border-slate-200">
                    <div><span className="font-semibold block">Gesetzliche Rente</span><span className="text-[10px] text-slate-500">Brutto: {formatResultCurrency(calculations.grvFutureGross)}</span></div>
                    <div className="sm:text-right"><span className="font-bold block text-sm sm:text-xs">{renderBonVal(calculations.grvNet)}</span><span className="text-[10px] text-rose-500">KV/PV: {formatResultCurrency(calculations.grvKvpv)} | ESt{hasChurchTax ? '+KiSt' : ''}: {formatResultCurrency(calculations.grvESt + calculations.grvKist)}</span></div>
                  </div>
                  {calculations.contracts.filter(c => c.layer === 1).map(c => (
                    <div key={c.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0 bg-slate-50 p-2 rounded print:border print:border-slate-200">
                      <div><span className="font-semibold block">{c.name}</span><span className="text-[10px] text-slate-500">Brutto: {formatResultCurrency(c.gross)}</span></div>
                      <div className="sm:text-right">
                        <span className="font-bold block text-sm sm:text-xs">{renderBonVal(c.net)}</span>
                        <span className="text-[10px] text-rose-500">
                          {c.kvpv_deduction > 0 ? `KV/PV: ${formatResultCurrency(c.kvpv_deduction)} | ` : ''}ESt{hasChurchTax ? '+KiSt' : ''}: {formatResultCurrency(c.tax + (c.kist || 0))} {c.kvpv_deduction === 0 ? '(KV/PV-frei)' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-purple-100 rounded-lg overflow-hidden print:border-slate-300 print:break-inside-avoid">
                <div className="flex items-center justify-between p-3 bg-purple-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s2')}>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500 print:bg-slate-800"></div><span className="font-bold text-sm text-purple-900 print:text-slate-800">Schicht 2 (Zusatz)</span></div>
                  <div className="flex items-center gap-3"><span className="font-bold text-sm sm:text-base">{renderBonVal(calculations.s2_net)}</span><ChevronDown className={`w-4 h-4 text-slate-400 print:hidden transition-transform ${expandedSections.s2 ? 'rotate-180' : ''}`} /></div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-purple-100 space-y-2 print:border-slate-300 ${expandedSections.s2 ? 'block' : 'hidden'} print:block`}>
                  {calculations.contracts.filter(c => c.layer === 2).length === 0 && <div className="text-slate-400 italic">Keine Verträge in Schicht 2</div>}
                  {calculations.contracts.filter(c => c.layer === 2).map(c => (
                    <div key={c.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0 bg-slate-50 p-2 rounded print:border print:border-slate-200">
                      <div>
                        <span className="font-semibold block">{c.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {c.type === 'bavKapital' ? `bAV Kapitalauszahlung | Bruttokapital: ${formatResultCurrency(c.gross)}` : `${c.type === 'bav' ? 'bAV' : 'Riester'} | Brutto: ${formatResultCurrency(c.gross)}`}
                        </span>
                        {c.type === 'bavKapital' && <div className="text-[9px] text-purple-600 mt-1 font-medium">Fünftelregelung & 120-Monats-KV-Regel</div>}
                      </div>
                      <div className="sm:text-right">
                        <span className={`font-bold block text-sm sm:text-xs ${c.type === 'bavKapital' && c.includeInNet === false ? 'text-slate-400' : ''}`}>
                          {c.type === 'bavKapital' && c.includeInNet === false ? formatResultCurrency(0) : renderBonVal(c.net)}
                        </span>
                        <span className="text-[10px] text-rose-500">
                          {c.type === 'bavKapital' && c.includeInNet === false ? 'Nicht angerechnet' : (
                            <>{c.kvpv_deduction > 0 ? `KV/PV: ${formatResultCurrency(c.kvpv_deduction)} | ` : ''}ESt{hasChurchTax ? '+KiSt' : ''}: {formatResultCurrency(c.tax + (c.kist || 0))} {c.kvpv_deduction === 0 ? '(KV/PV-frei)' : ''}</>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-emerald-100 rounded-lg overflow-hidden print:border-slate-300 print:break-inside-avoid">
                <div className="flex items-center justify-between p-3 bg-emerald-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s3')}>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 print:bg-slate-800"></div><span className="font-bold text-sm text-emerald-900 print:text-slate-800">Schicht 3 (Privat)</span></div>
                  <div className="flex items-center gap-3"><span className="font-bold text-sm sm:text-base">{renderBonVal(calculations.s3_net)}</span><ChevronDown className={`w-4 h-4 text-slate-400 print:hidden transition-transform ${expandedSections.s3 ? 'rotate-180' : ''}`} /></div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-emerald-100 space-y-2 print:border-slate-300 ${expandedSections.s3 ? 'block' : 'hidden'} print:block`}>
                  {calculations.contracts.filter(c => c.layer === 3).map(c => (
                    <div key={c.id} className="flex flex-col sm:flex-row justify-between sm:items-start gap-1 sm:gap-0 bg-slate-50 p-2 rounded print:border print:border-slate-200">
                      <div>
                        <span className="font-semibold block flex items-center gap-1">
                           {c.type === 'immobilie' && <Home className="w-3 h-3 text-emerald-600" />} {c.name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {c.type === 'prvRente' ? `Brutto: ${formatResultCurrency(c.gross)} (Ertragsanteil: ${Math.round(calculations.ertragsanteilRate * 100)}%)` 
                          : c.type === 'immobilie' ? `Miete (Netto nach Kosten): ${formatResultCurrency(c.taxableRent)}`
                          : c.type === 'etf' ? `Depotwert im Alter: ${formatResultCurrency(c.totalCap)} | Entnahme: ${c.withdrawalRate}% p.a.`
                          : `Bruttokapital: ${formatResultCurrency(c.gross)}`}
                        </span>
                        {c.type === 'prvKapital' && <div className="text-[9px] text-indigo-500 mt-1 font-medium">Günstigerprüfung: {c.appliedTaxMethod}</div>}
                        {c.type === 'immobilie' && kvStatus === 'freiwillig' && <div className="text-[9px] text-rose-500 mt-1 font-medium">KV/PV-pflichtig (Freiwillig versichert)</div>}
                      </div>
                      <div className="sm:text-right">
                        <span className={`font-bold block text-sm sm:text-xs ${(c.type === 'prvKapital' || c.type === 'immobilie' || c.type === 'etf') && c.includeInNet === false ? 'text-slate-400' : ''}`}>
                          {(c.type === 'prvKapital' || c.type === 'immobilie' || c.type === 'etf') && c.includeInNet === false ? formatResultCurrency(0) : renderBonVal(c.net)}
                        </span>
                        <span className="text-[10px] text-rose-500">
                           {(c.type === 'prvKapital' || c.type === 'immobilie' || c.type === 'etf') && c.includeInNet === false ? 'Nicht angerechnet' : (
                             <>{c.kvpv_deduction > 0 ? `KV/PV: ${formatResultCurrency(c.kvpv_deduction)} | ` : ''}{c.type === 'etf' ? 'Abgeltung' : 'Steuerlast'}{hasChurchTax ? ' inkl. KiSt' : ''}: {formatResultCurrency(c.tax + (c.kist || 0))} {c.type !== 'etf' && c.kvpv_deduction === 0 ? '(KV/PV-frei)' : ''}</>
                           )}
                        </span>
                      </div>
                    </div>
                  ))}

                  {includePlanerInNet && (
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0 bg-indigo-50 p-2 rounded border-l-2 border-indigo-400 mt-2 print:border-slate-400">
                      <div><span className="font-semibold text-indigo-900 print:text-slate-800 block">Planer Wunsch-Rente</span><span className="text-[10px] text-indigo-700 print:text-slate-600">Manuelle Entnahme aus Kapital</span></div>
                      <div className="sm:text-right"><span className="font-bold text-indigo-900 print:text-slate-800 block text-sm sm:text-xs">{renderBonVal(planerWithdrawal)}</span></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden print:flex items-center justify-between p-4 mt-4 rounded bg-slate-100 text-slate-800 border-2 border-slate-800 break-inside-avoid">
                <div className="font-bold text-lg">Erwartetes Gesamt-Netto</div>
                <div className="font-bold text-xl">{renderBonVal(calculations.totalNetFuture)}</div>
              </div>
            </div>
          </div>

          <div className={`bg-white rounded-xl border p-4 sm:p-6 h-[480px] print:block print:mt-12 print:break-inside-avoid ${rightView === 'verlauf' ? 'block' : 'hidden'}`}>
            <h2 className="text-sm font-bold mb-6">Kapitalverlauf (Depot-Entnahme)</h2>
            <div className="w-full h-[350px] relative" onMouseLeave={() => setHoveredData(null)}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
                {yTicks.map((val, i) => (
                  <g key={`y-${i}`}>
                    <line x1={paddingX} y1={getY(val)} x2={svgWidth - paddingX} y2={getY(val)} stroke="#f1f5f9" strokeWidth="1" className="print:stroke-slate-200" />
                    <text x={paddingX - 10} y={getY(val) + 4} fontSize="11" fill="#94a3b8" textAnchor="end" fontWeight="500" className="print:fill-slate-600">{formatYAxis(val)}</text>
                  </g>
                ))}
                
                {calculations.chartData.filter((d, i) => d.age % 5 === 0 || i === 0 || i === calculations.chartData.length - 1).map((d) => {
                  const origIndex = calculations.chartData.indexOf(d);
                  return (
                    <g key={`x-${d.age}`}>
                      <text x={getX(origIndex)} y={svgHeight - 15} fontSize="11" fill="#94a3b8" textAnchor="middle" fontWeight="500" className="print:fill-slate-600">{d.age} J.</text>
                      <line x1={getX(origIndex)} y1={svgHeight - bottomPadding} x2={getX(origIndex)} y2={svgHeight - bottomPadding + 5} stroke="#cbd5e1" className="print:stroke-slate-400" />
                    </g>
                  );
                })}

                <line x1={paddingX} y1={svgHeight - bottomPadding} x2={svgWidth - paddingX} y2={svgHeight - bottomPadding} stroke="#cbd5e1" strokeWidth="2" className="print:stroke-slate-400" />

                {calculations.etfTotalCapital > 0 && <path d={etfPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                {planerCalculations.nettoVerrentungsKapital > 0 && <path d={planerPath} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" />}

                {calculations.chartData.map((d, i) => {
                  const rectWidth = (svgWidth - paddingX * 2) / Math.max(1, calculations.chartData.length - 1);
                  return (
                    <rect 
                      key={`hover-${i}`} 
                      x={getX(i) - rectWidth/2} y={0} width={rectWidth} height={svgHeight - bottomPadding} 
                      fill="transparent" 
                      onMouseEnter={() => setHoveredData({ ...d, index: i })}
                      className="cursor-crosshair outline-none print:hidden"
                    />
                  );
                })}

                {hoveredData && (
                  <line x1={getX(hoveredData.index)} y1={paddingY} x2={getX(hoveredData.index)} y2={svgHeight - bottomPadding} stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" className="pointer-events-none print:hidden" />
                )}
              </svg>

              <div className="absolute top-0 right-0 sm:right-4 flex flex-col sm:flex-row gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold bg-white/90 p-2 rounded shadow-sm sm:shadow-none backdrop-blur-sm print:bg-white">
                <div className="flex items-center gap-1.5 text-emerald-600 print:text-slate-800"><div className="w-3 h-1 bg-emerald-500 rounded"></div> Alle ETF Depots</div>
                <div className="flex items-center gap-1.5 text-indigo-600 print:text-slate-800"><div className="w-3 h-1 border-b-2 border-indigo-500 border-dashed rounded"></div> Entnahme-Planer</div>
              </div>

              {hoveredData && (
                <div className="absolute bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs sm:text-sm z-10 pointer-events-none transition-all duration-75 border border-slate-700 min-w-[150px] sm:min-w-[180px] print:hidden" 
                  style={{ top: '10%', ...(hoveredData.index > calculations.chartData.length / 2 ? { right: `${100 - ((getX(hoveredData.index) / svgWidth) * 100) + 2}%` } : { left: `${(getX(hoveredData.index) / svgWidth) * 100 + 2}%` }) }}
                >
                   <div className="font-bold border-b border-slate-700 pb-1.5 mb-2 flex items-center gap-2"><Clock className="w-3 h-3 text-slate-400" /> Alter: {hoveredData.age} Jahre</div>
                   <div className="space-y-1.5">
                     <div className="flex justify-between items-center gap-4 text-emerald-400"><span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> ETFs (Summe)</span><span className="font-mono">{formatChartCurrency(hoveredData.etf, hoveredData.discount)}</span></div>
                     <div className="flex justify-between items-center gap-4 text-indigo-400"><span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Planer</span><span className="font-mono">{formatChartCurrency(hoveredData.planer, hoveredData.discount)}</span></div>
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* LÖSUNGS-RECHNER */}
          <div className="bg-slate-900 rounded-xl p-4 sm:p-6 shadow-sm border border-slate-800 text-white print:bg-white print:text-slate-800 print:border-slate-300">
              <h3 className="text-sm font-bold text-indigo-400 mb-4 flex items-center gap-2 print:text-indigo-700">
                  <Activity className="w-5 h-5" /> Lösungs-Rechner: Rentenlücke schließen
              </h3>
              {calculations.gap <= 0 ? (
                  <div className="text-emerald-400 font-medium">Glückwunsch! Sie haben Ihre Rentenlücke vollständig geschlossen.</div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 print:bg-slate-50 print:border-slate-200">
                          <div className="text-xs text-slate-400 mb-1 print:text-slate-500">Benötigtes Kapital zu Rentenbeginn</div>
                          <div className="text-2xl sm:text-3xl font-bold text-emerald-400">{formatResultCurrency(calculations.requiredCapital)}</div>
                          <div className="text-[10px] text-slate-500 mt-2 leading-relaxed">Reicht für 25 Jahre (Kapitalverzehr bei 2% p.a. Rendite im Alter), um die mtl. Lücke von {formatResultCurrency(calculations.gap)} auszugleichen.</div>
                      </div>
                      
                      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 print:bg-slate-50 print:border-slate-200">
                          <div className="flex justify-between items-start mb-2">
                              <div className="text-xs text-slate-400 print:text-slate-500">Mtl. Start-Sparrate (heute)</div>
                          </div>
                          <div className="text-2xl sm:text-3xl font-bold text-white print:text-slate-800">
                              {calculations.yearsToRetirement > 0 ? formatCurrency(calculations.requiredSavings) : "Sofort fällig"}
                          </div>

                          <div className="flex flex-row flex-wrap sm:items-center gap-2 sm:gap-3 mt-3 pt-3 border-t border-slate-700 print:border-slate-300">
                               <div>
                                   <label className="block text-[9px] text-slate-400 uppercase mb-0.5">Rendite p.a.</label>
                                   <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-600 print:bg-white print:border-slate-300">
                                        <input type="number" step="0.1" value={solutionSavingsReturn} onChange={e => setSolutionSavingsReturn(Number(e.target.value))} className="w-10 sm:w-12 bg-transparent text-xs outline-none text-white print:text-slate-800" />
                                        <span className="text-[10px] text-slate-400">%</span>
                                   </div>
                               </div>
                               <div>
                                   <label className="block text-[9px] text-slate-400 uppercase mb-0.5">Dynamik p.a.</label>
                                   <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-600 print:bg-white print:border-slate-300">
                                        <input type="number" step="0.1" value={solutionSavingsDynamic} onChange={e => setSolutionSavingsDynamic(Number(e.target.value))} className="w-10 sm:w-12 bg-transparent text-xs outline-none text-white print:text-slate-800" />
                                        <span className="text-[10px] text-slate-400">%</span>
                                   </div>
                               </div>
                          </div>
                          
                          <div className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                              {solutionSavingsDynamic > 0 
                                  ? <span>Startrate für das 1. Jahr. Durch die <strong className="text-indigo-400">{solutionSavingsDynamic}% Dynamik</strong> steigt die Rate jährlich. Die letzte Rate vor der Rente (in {calculations.yearsToRetirement} J.) liegt bei ca. {formatCurrency(calculations.requiredSavings * Math.pow(1 + solutionSavingsDynamic/100, Math.max(0, calculations.yearsToRetirement - 1)))}.</span>
                                  : `Konstante monatliche Sparrate über die restlichen ${calculations.yearsToRetirement} Jahre bis zum Renteneintritt.`}
                          </div>
                      </div>
                  </div>
              )}
          </div>

        </div>
      </main>

      {/* --- STICKY BOTTOM BAR (DASHBOARD FOOTER) --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:px-6 flex justify-between items-center">
          
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold">Zielbedarf</span>
            <span className="text-sm sm:text-lg font-bold text-white">{formatResultCurrency(calculations.targetIncomeFuture)}</span>
          </div>

          <div className="hidden sm:block w-px h-8 bg-slate-700 mx-2"></div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] sm:text-xs text-emerald-400 uppercase font-bold flex items-center gap-1 sm:gap-1.5">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4" /> Gesamt-Netto
            </span>
            <span className="text-xl sm:text-3xl font-black text-emerald-400">{formatResultCurrency(calculations.totalNetFuture)}</span>
          </div>

          <div className="hidden sm:block w-px h-8 bg-slate-700 mx-2"></div>

          <div className="flex flex-col text-right">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold">Rentenlücke</span>
            <span className={`text-sm sm:text-lg font-bold ${calculations.gap > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {calculations.gap > 0 ? formatResultCurrency(calculations.gap) : 'Gedeckt!'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}