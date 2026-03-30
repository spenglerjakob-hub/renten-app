import React, { useState, useMemo } from 'react';
import { 
  Upload, FileText, TrendingUp, AlertCircle, Calculator, 
  CheckCircle, ChevronDown, ChevronUp, ShieldAlert, PiggyBank, 
  Briefcase, PlusCircle, Trash, Users, User, Info, Coins, Clock, Infinity as InfinityIcon, Wallet, Activity,
  LineChart as LineChartIcon, List, Download
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
  const [currentNetIncome, setCurrentNetIncome] = useState(3000);
  const [hasChildren, setHasChildren] = useState(true);
  const [isMarried, setIsMarried] = useState(false); 
  const [showRealValue, setShowRealValue] = useState(false);
  
  // Kirchensteuer State
  const [hasChurchTax, setHasChurchTax] = useState(false);

  // Krankenversicherungs-Status
  const [kvStatus, setKvStatus] = useState('kvdr'); 
  const [pkvPremium, setPkvPremium] = useState(600);

  // Basis (GRV)
  const [grvGross, setGrvGross] = useState(0);
  const [grvIncreaseRate, setGrvIncreaseRate] = useState(1.5);

  // Depot (ETF)
  const [privateCapital, setPrivateCapital] = useState(0);
  const [privateMonthly, setPrivateMonthly] = useState(0);
  const [expectedReturnAcc, setExpectedReturnAcc] = useState(6.0);
  const [expectedReturnWith, setExpectedReturnWith] = useState(3.0);
  const [etfTer, setEtfTer] = useState(0.2); 
  const [withdrawalRate, setWithdrawalRate] = useState(4.0);
  const [includeEtfInNet, setIncludeEtfInNet] = useState(true);

  // Multi-Vertrags-Logik
  const [contracts, setContracts] = useState([]);

  // UI States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('s1');
  const [expandedSections, setExpandedSections] = useState({ s1: true, s2: true, s3: true });
  const [rightView, setRightView] = useState('zusammensetzung'); 
  const [hoveredData, setHoveredData] = useState(null); 

  // Planer States 
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
      setPrivateCapital(25000);
      setPrivateMonthly(150);
      setExpectedReturnAcc(6.0);
      setExpectedReturnWith(3.5);
      setKvStatus('kvdr');
      setHasChurchTax(true);
      setContracts([
        { id: 1, layer: 1, type: 'basis', name: 'Rürup Rente', gross: 300 },
        { id: 2, layer: 2, type: 'bav', name: 'bAV Direktversicherung', gross: 250 },
        { id: 6, layer: 2, type: 'bavKapital', name: 'bAV Kapitalauszahlung', gross: 50000, includeInNet: true },
        { id: 3, layer: 2, type: 'riester', name: 'Fonds-Riester', gross: 150 },
        { id: 4, layer: 3, type: 'prvRente', name: 'Private Rente Klassik', gross: 120 },
        { id: 5, layer: 3, type: 'prvKapital', name: 'Fonds-Police (Kapital)', gross: 45000, startYear: 2010, monthlyPremium: 100, dynamic: 5, includeInNet: true }
      ]);
      setIncludeEtfInNet(true);
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

  const removeContract = (id) => {
    setContracts(contracts.filter(c => c.id !== id));
  };

  const handleLoadPlaner = () => {
    const etf = calculations.etfTotalCapital || 0;
    const prv = calculations.contracts.filter(c => c.type === 'prvKapital' || c.type === 'bavKapital').reduce((s, c) => s + (c.netCapital || 0), 0);
    setPlanerCapital(Math.round(etf + prv));
    setIncludeEtfInNet(false);
    setContracts(prev => prev.map(c => (c.type === 'prvKapital' || c.type === 'bavKapital') ? { ...c, includeInNet: false } : c));
  };

  // --- BERECHNUNGSLOGIK ---
  const calculations = useMemo(() => {
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const inflationFactor = Math.pow(1.02, yearsToRetirement);
    const targetIncomeFuture = (currentNetIncome * 0.8) * inflationFactor;
    const retirementYear = new Date().getFullYear() + yearsToRetirement;

    const ertragsanteilRate = getErtragsanteil(retirementAge);
    const taxBasePercent = Math.min(1.0, 0.84 + (Math.max(0, retirementYear - 2026) * 0.005));
    const kistRate = hasChurchTax ? 0.08 : 0;
    
    const kvRateFull = 0.175; 
    const kvRateHalf = kvRateFull / 2; 
    const pvRateFull = hasChildren ? 0.036 : 0.042;
    const bavFreibetragKV = 197.75; 
    const BBG_KV = 6450; 

    const grvFutureGross = grvGross * Math.pow(1 + grvIncreaseRate / 100, yearsToRetirement);
    const rentenFreibetrag = grvFutureGross * (1 - taxBasePercent); 
    let zvE_total = grvFutureGross - rentenFreibetrag;

    let deductible_kvpv = 0;
    let grvKvpv = 0;
    let total_income_for_freiwillig = grvFutureGross;

    if (kvStatus === 'pkv') {
      const grvSubsidy = grvFutureGross * kvRateHalf; 
      grvKvpv = Math.max(0, pkvPremium - grvSubsidy); 
      deductible_kvpv = pkvPremium * 0.8; 
    } else if (kvStatus === 'kvdr') {
      grvKvpv = grvFutureGross * (kvRateHalf + pvRateFull);
      deductible_kvpv += grvKvpv;
    }

    let s1_brutto = grvFutureGross;
    let s2_brutto = 0;
    let s3_brutto_rente = 0;

    const processedContracts = contracts.map(c => {
      let zvE_contribution = 0;
      let kvpv_deduction = 0;

      if (c.type === 'basis') {
        const freibetragBasis = c.gross * (1 - taxBasePercent);
        zvE_contribution = c.gross - freibetragBasis; 
        total_income_for_freiwillig += c.gross;
      } 
      else if (c.type === 'bav') {
        zvE_contribution = c.gross; 
        total_income_for_freiwillig += c.gross;
        
        if (kvStatus === 'kvdr') {
          const bav_kv = Math.max(0, c.gross - bavFreibetragKV) * kvRateFull;
          const bav_pv = c.gross > bavFreibetragKV ? c.gross * pvRateFull : 0;
          kvpv_deduction = bav_kv + bav_pv;
          deductible_kvpv += kvpv_deduction;
        }
      }
      // bavKapital fließt nicht in das monatliche zvE ein (wird separat mit Fünftelregelung besteuert)
      else if (c.type === 'riester') {
        zvE_contribution = c.gross; 
        total_income_for_freiwillig += c.gross;
      }
      else if (c.type === 'prvRente') {
        zvE_contribution = c.gross * ertragsanteilRate; 
        total_income_for_freiwillig += c.gross; 
      }
      
      zvE_total += zvE_contribution;
      return { ...c, zvE_contribution, kvpv_deduction };
    });

    let freiwillig_total_kvpv = 0;
    if (kvStatus === 'freiwillig') {
      const cappedIncome = Math.min(BBG_KV, total_income_for_freiwillig);
      freiwillig_total_kvpv = (cappedIncome * (kvRateFull + pvRateFull)) - (grvFutureGross * kvRateHalf);
      grvKvpv = freiwillig_total_kvpv; 
      deductible_kvpv = (cappedIncome * (kvRateFull + pvRateFull)); 
    }

    const zvE_yearly = Math.max(0, zvE_total * 12 - (deductible_kvpv * 12));
    const yearlyESt = calculateESt(zvE_yearly, isMarried);
    const monthlyESt = yearlyESt / 12;
    const baseForAvgTax = (zvE_total * 12);
    const avgTaxRate = baseForAvgTax > 0 ? (yearlyESt / baseForAvgTax) : 0;
    const estPlus100 = calculateESt(zvE_yearly + 100, isMarried);
    const marginalTaxRate = (estPlus100 - yearlyESt) / 100;

    const grvESt = (grvFutureGross - rentenFreibetrag) * avgTaxRate;
    const grvKist = grvESt * kistRate;
    const grvNet = Math.max(0, grvFutureGross - grvKvpv - grvESt - grvKist);
    
    let s1_net = grvNet;
    let s2_net = 0;
    let s3_net = 0;

    const finalizedContracts = processedContracts.map(c => {
      let net = 0;
      let tax = 0;
      let kist = 0;

      if (c.type === 'basis') {
        tax = c.zvE_contribution * avgTaxRate;
        kist = tax * kistRate;
        net = c.gross - tax - kist;
        s1_net += net;
      } 
      else if (c.type === 'bav' || c.type === 'riester') {
        tax = c.zvE_contribution * avgTaxRate;
        kist = tax * kistRate;
        net = c.gross - (kvStatus === 'kvdr' ? c.kvpv_deduction : 0) - tax - kist;
        s2_net += net;
      }
      else if (c.type === 'bavKapital') {
        const taxFuenftel = (calculateESt(zvE_yearly + (c.gross / 5), isMarried) - yearlyESt) * 5;
        const kistFuenftel = taxFuenftel * kistRate;
        
        const monthlyBavGross = c.gross / 120;
        let monthlyKvPv = 0;
        
        if (kvStatus === 'kvdr' || kvStatus === 'freiwillig') {
          const kv = Math.max(0, monthlyBavGross - bavFreibetragKV) * kvRateFull;
          const pv = monthlyBavGross > bavFreibetragKV ? monthlyBavGross * pvRateFull : 0;
          monthlyKvPv = kv + pv;
        }
        
        const totalKvPv = monthlyKvPv * 120;
        
        tax = taxFuenftel;
        kist = kistFuenftel;
        c.kvpv_deduction = totalKvPv;
        c.netCapital = Math.max(0, c.gross - tax - kist - totalKvPv);
        
        const monthlyFromCapital = (c.netCapital * (withdrawalRate / 100)) / 12;
        c.monthlyNet = monthlyFromCapital;
        
        if (c.includeInNet !== false) {
           net = monthlyFromCapital;
           s2_net += net;
        }
      }
      else if (c.type === 'prvRente') {
        tax = c.zvE_contribution * avgTaxRate;
        kist = tax * kistRate;
        net = c.gross - tax - kist;
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
        
        const taxHalb = profit * 0.5 * 0.85 * marginalTaxRate;
        const kistHalb = taxHalb * kistRate;
        
        const abgeltungRate = hasChurchTax ? 0.278186 : 0.26375;
        const taxAbgeltung = profit * 0.85 * abgeltungRate;
        
        if ((taxHalb + kistHalb) < taxAbgeltung) {
          tax = taxHalb;
          kist = kistHalb;
          c.appliedTaxMethod = 'Halbeinkünfte';
        } else {
          tax = taxAbgeltung; 
          kist = 0; 
          c.appliedTaxMethod = 'Abgeltungsteuer';
        }
        
        const netCapital = Math.max(0, c.gross - tax - kist);
        c.netCapital = netCapital;
        
        const monthlyFromCapital = (netCapital * (withdrawalRate / 100)) / 12;
        c.monthlyNet = monthlyFromCapital;
        
        if (c.includeInNet !== false) {
           net = monthlyFromCapital;
           s3_net += net;
        }
        c.profit = profit;
      }

      return { ...c, net, tax, kist };
    });

    // Berechnung der echten Netto-Renditen nach Kosten (TER)
    const netReturnAcc = Math.max(0, expectedReturnAcc - etfTer);
    const netReturnWith = Math.max(0, expectedReturnWith - etfTer);

    const r_monthly_acc = (netReturnAcc / 100) / 12;
    const months = yearsToRetirement * 12;
    const etfCapFuture = (privateCapital || 0) * Math.pow(1 + (netReturnAcc/100), yearsToRetirement);
    
    // VERHINDERT NaN FEHLER: Fallback, falls r_monthly_acc === 0 (z.B. wenn erwartete Rendite - TER <= 0)
    let etfMonthlyFuture = 0;
    if (privateMonthly > 0 && months > 0) {
      etfMonthlyFuture = r_monthly_acc === 0 
        ? privateMonthly * months 
        : privateMonthly * ((Math.pow(1 + r_monthly_acc, months) - 1) / r_monthly_acc);
    }
    
    const etfTotalCapital = etfCapFuture + etfMonthlyFuture;
    const etfGrossMonthly = (etfTotalCapital * (withdrawalRate / 100)) / 12;
    
    const etfTaxRate = hasChurchTax ? 0.12 : 0.1145;
    const etfTax = etfGrossMonthly * etfTaxRate; 
    const etfNet = etfGrossMonthly - etfTax;
    
    if (includeEtfInNet) s3_net += etfNet;
    if (includePlanerInNet) s3_net += planerWithdrawal;

    const chartData = [];
    let curEtfChart = etfTotalCapital;
    let curEtfWithChart = etfGrossMonthly * 12;
    let curPlanerChart = Math.max(0, planerCapital);
    let curPlanerWithChart = planerWithdrawal * 12;
    let etfRunOutAge = retirementAge;
    let isDepleted = false;

    for (let age = retirementAge; age <= 100; age++) {
      const discount = Math.pow(1.02, age - currentAge);
      chartData.push({ age, etf: Math.max(0, curEtfChart), planer: Math.max(0, curPlanerChart), discount });

      if (curEtfChart > 0) {
        curEtfChart = curEtfChart * (1 + netReturnWith / 100) - curEtfWithChart;
        if (curEtfChart <= 0 && !isDepleted) {
          etfRunOutAge = age;
          isDepleted = true;
        }
        curEtfWithChart *= 1.02; 
      }

      if (curPlanerChart > 0) {
        curPlanerChart = curPlanerChart * (1 + planerReturn / 100) - curPlanerWithChart;
        curPlanerWithChart *= (1 + planerDynamic / 100);
      }
    }
    if (!isDepleted) etfRunOutAge = 100;

    const totalNetFuture = s1_net + s2_net + s3_net;
    const gap = Math.max(0, targetIncomeFuture - totalNetFuture);

    return {
      yearsToRetirement, targetIncomeFuture, targetIncomeToday: currentNetIncome * 0.8,
      inflationFactor, chartData,
      zvE_yearly, yearlyESt, avgTaxRate, marginalTaxRate, deductible_kvpv, rentenFreibetrag, ertragsanteilRate, kistRate,
      grvFutureGross, grvNet, grvKvpv, grvESt, grvKist,
      s1_net, s2_net, s3_net,
      contracts: finalizedContracts,
      etfTotalCapital, etfGrossMonthly, etfNet, etfRunOutAge, isDepleted,
      totalNetFuture, gap
    };
  }, [
    currentAge, retirementAge, currentNetIncome, hasChildren, isMarried, kvStatus, pkvPremium, hasChurchTax,
    grvGross, grvIncreaseRate, 
    privateCapital, privateMonthly, expectedReturnAcc, expectedReturnWith, etfTer, withdrawalRate, includeEtfInNet,
    contracts, planerCapital, planerWithdrawal, planerReturn, planerDynamic, includePlanerInNet
  ]);

  const planerCalculations = useMemo(() => {
    const nettoVerrentungsKapital = Math.max(0, planerCapital);
    let currentCap = nettoVerrentungsKapital;
    let currentWith = planerWithdrawal * 12;
    let yearsLasted = 0;

    if (nettoVerrentungsKapital > 0 && planerWithdrawal > 0) {
      for (let i = 0; i < 100; i++) {
        currentCap = currentCap * (1 + planerReturn / 100) - currentWith;
        if (currentCap <= 0) break;
        currentWith *= (1 + planerDynamic / 100);
        yearsLasted++;
      }
    }

    return {
      nettoVerrentungsKapital,
      yearsLasted,
      runOutAge: retirementAge + yearsLasted,
      lastsForever: yearsLasted >= 99
    };
  }, [planerCapital, planerWithdrawal, planerReturn, planerDynamic, retirementAge]);


  // --- RENDER HELPERS ---
  const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  const formatResultCurrency = (val) => formatCurrency(showRealValue ? val / calculations.inflationFactor : val);
  const formatChartCurrency = (val, discount) => formatCurrency(showRealValue ? val / discount : val);
  const formatYAxis = (val) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1).replace('.0', '') + ' Mio.';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return val.toString();
  };

  const renderContractInput = (c) => {
    return (
      <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm relative group mb-3">
        <button onClick={() => removeContract(c.id)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 transition-colors">
          <Trash className="w-4 h-4" />
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 pr-6">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Vertragsart</label>
            <select value={c.type} onChange={e => updateContract(c.id, 'type', e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50 focus:bg-white">
              {c.layer === 1 && <option value="basis">Rürup / Basisrente</option>}
              {c.layer === 2 && (
                <>
                  <option value="bav">Betriebliche Altersvorsorge (Rente)</option>
                  <option value="bavKapital">Betriebliche Altersvorsorge (Kapital)</option>
                  <option value="riester">Riester-Rente</option>
                </>
              )}
              {c.layer === 3 && (
                <>
                  <option value="prvRente">Private Rente (monatlich)</option>
                  <option value="prvKapital">Private Rente (Kapitalauszahlung)</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Bezeichnung</label>
            <input type="text" value={c.name} onChange={e => updateContract(c.id, 'name', e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" placeholder="z.B. Allianz" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
            {c.type.includes('Kapital') ? 'Erwartete Kapitalauszahlung (€ Brutto)' : 'Erwartete Rente (€/Monat Brutto)'}
          </label>
          <input type="number" value={c.gross || ''} onChange={e => updateContract(c.id, 'gross', Number(e.target.value))} className="w-full border border-slate-300 rounded p-2 text-sm font-semibold" />
        </div>
        
        {(c.type === 'prvKapital' || c.type === 'bavKapital') && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
            {c.type === 'prvKapital' && (
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Beginn (Jahr)</label><input type="number" value={c.startYear || ''} onChange={e => updateContract(c.id, 'startYear', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
                <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Mtl. Beitrag (€)</label><input type="number" value={c.monthlyPremium || ''} onChange={e => updateContract(c.id, 'monthlyPremium', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
                <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Dynamik (%)</label><input type="number" step="0.1" value={c.dynamic || ''} onChange={e => updateContract(c.id, 'dynamic', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" checked={c.includeInNet !== false} onChange={e => updateContract(c.id, 'includeInNet', e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-3 h-3" />
              <label className="text-[10px] text-slate-600 font-medium cursor-pointer" onClick={() => updateContract(c.id, 'includeInNet', c.includeInNet === false)}>
                In monatliche Rente umwandeln & ins Gesamt-Netto einrechnen
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- SVG CHART RENDER HELPERS ---
  const svgWidth = 800;
  const svgHeight = 350;
  const paddingX = 40;
  const paddingY = 20;
  const bottomPadding = 40;
  const graphHeight = svgHeight - paddingY - bottomPadding;

  // VERHINDERT NaN FEHLER: Sicheres Abgreifen von maxDataVal ohne Absturz bei leeren oder fehlerhaften Chart-Einträgen
  const maxDataVal = calculations.chartData.length > 0 
    ? Math.max(0, ...calculations.chartData.map(d => {
        const vEtf = showRealValue ? (d.etf / d.discount) : d.etf;
        const vPlaner = showRealValue ? (d.planer / d.discount) : d.planer;
        const val = Math.max(vEtf || 0, vPlaner || 0);
        return isNaN(val) ? 0 : val;
      }))
    : 0;

  const maxY = Math.max(100, (isNaN(maxDataVal) ? 0 : maxDataVal) * 1.1); 

  const getX = (index) => paddingX + (index / (calculations.chartData.length - 1)) * (svgWidth - paddingX * 2);
  
  // VERHINDERT NaN FEHLER: Sicheres Fallback, falls y-Wert oder Maximalwert fehlerhaft sind
  const getY = (val) => {
    if (isNaN(val) || isNaN(maxY) || maxY === 0) return svgHeight - bottomPadding;
    return svgHeight - bottomPadding - (val / maxY) * graphHeight;
  };

  const etfPath = calculations.chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(showRealValue ? d.etf / d.discount : d.etf)}`).join(" ");
  const planerPath = calculations.chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(showRealValue ? d.planer / d.discount : d.planer)}`).join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(mult => maxY * mult);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12 print:bg-white print:pb-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-6 shadow-md print:shadow-none print:bg-slate-900">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold">Vorsorge-Analyzer Pro</h1>
              <p className="text-slate-400 text-sm">Präzisions-Engine 2026 inkl. KV-Status & KiSt</p>
            </div>
          </div>
          
          <div className="flex bg-slate-800 p-1.5 rounded-lg border border-slate-700 gap-1 flex-wrap justify-end print:hidden">
            <button onClick={() => setShowRealValue(!showRealValue)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${showRealValue ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
              <Coins className="w-4 h-4" /> Kaufkraft heute
            </button>
            <div className="w-px bg-slate-700 mx-1"></div>
            <button onClick={() => setIsMarried(false)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!isMarried ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
              <User className="w-4 h-4" /> Single
            </button>
            <button onClick={() => setIsMarried(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${isMarried ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
              <Users className="w-4 h-4" /> Verheiratet
            </button>
            <div className="w-px bg-slate-700 mx-1"></div>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-rose-600 text-white shadow hover:bg-rose-500 transition-all">
              <Download className="w-4 h-4" /> PDF Report
            </button>
          </div>
        </div>
      </header>

      {/* Exklusiver Druck-Header */}
      <div className="hidden print:block max-w-6xl mx-auto p-6 text-center border-b-2 border-slate-200 mb-6">
        <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-widest">Persönliches Vorsorge-Gutachten</h2>
        <p className="text-slate-500 mt-2">Erstellt auf Basis der Steuer- und Sozialgesetzgebung 2026</p>
        <div className="flex justify-center gap-6 mt-4 text-sm font-semibold text-slate-600">
          <span>{isMarried ? 'Steuertarif: Splitting' : 'Steuertarif: Grundtarif'}</span>
          <span>•</span>
          <span>KV-Status: {kvStatus === 'pkv' ? 'Privat' : kvStatus === 'freiwillig' ? 'Freiwillig GKV' : 'Pflicht (KVdR)'}</span>
          <span>•</span>
          <span>Darstellung: {showRealValue ? 'Kaufkraft heute' : 'Nominalwert'}</span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 print:p-0 print:block">
        
        {/* LEFT COLUMN: Inputs */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-6 print:hidden">
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold mb-4 text-slate-700 border-b border-slate-100 pb-2">Personenbezogene Daten</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-xs font-semibold text-slate-500 mb-1">Alter</label><input type="number" value={currentAge} onChange={e => setCurrentAge(Number(e.target.value))} className="w-full border rounded p-2" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 mb-1">Renteneintritt</label><input type="number" value={retirementAge} onChange={e => setRetirementAge(Number(e.target.value))} className="w-full border rounded p-2" /></div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Heutiges Haushalts-Nettoeinkommen (€)</label>
              <input type="number" value={currentNetIncome} onChange={e => setCurrentNetIncome(Number(e.target.value))} className="w-full border rounded p-2" />
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
              {kvStatus === 'pkv' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Erwarteter PKV-Beitrag (€/Monat)</label>
                  <input type="number" value={pkvPremium} onChange={e => setPkvPremium(Number(e.target.value))} className="w-full border rounded p-2 text-sm" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={hasChildren} onChange={e => setHasChildren(e.target.checked)} className="rounded" />
                <label className="text-xs text-slate-600">Kinder vorhanden (PV-Zuschlag entfällt)</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={hasChurchTax} onChange={e => setHasChurchTax(e.target.checked)} className="rounded text-indigo-600" />
                <label className="text-xs text-slate-600">Kirchensteuer berechnen (8 %)</label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button className={`flex-1 py-3 px-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${activeTab === 's1' ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-slate-500 hover:bg-white'}`} onClick={() => setActiveTab('s1')}>Schicht 1</button>
              <button className={`flex-1 py-3 px-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${activeTab === 's2' ? 'bg-white text-purple-700 border-b-2 border-purple-700' : 'text-slate-500 hover:bg-white'}`} onClick={() => setActiveTab('s2')}>Schicht 2</button>
              <button className={`flex-1 py-3 px-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${activeTab === 's3' ? 'bg-white text-emerald-700 border-b-2 border-emerald-700' : 'text-slate-500 hover:bg-white'}`} onClick={() => setActiveTab('s3')}>Schicht 3</button>
              <button className={`flex-1 py-3 px-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${activeTab === 'planer' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-700' : 'text-slate-500 hover:bg-white'}`} onClick={() => setActiveTab('planer')}>Planer</button>
            </div>

            <div className="p-5 bg-slate-50/50 min-h-[400px]">
              {activeTab === 's1' && (
                <div className="space-y-5">
                  <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Gesetzliche Rente</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Anspruch (€)</label><input type="number" value={grvGross} onChange={e => setGrvGross(Number(e.target.value))} className="w-full border rounded p-2" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Dynamik (% p.a.)</label><input type="number" step="0.1" value={grvIncreaseRate} onChange={e => setGrvIncreaseRate(Number(e.target.value))} className="w-full border rounded p-2" /></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Zusätzliche Basisrenten</h3>
                    {contracts.filter(c => c.layer === 1).map(renderContractInput)}
                    <button onClick={() => addContract(1)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-medium text-sm hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors"><PlusCircle className="w-4 h-4" /> Vertrag hinzufügen</button>
                  </div>
                </div>
              )}

              {activeTab === 's2' && (
                <div className="space-y-5">
                  <div className="bg-purple-50 p-3 rounded text-xs text-purple-800 border border-purple-100 flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>bAV unterliegt voll der KV/PV, Riester ist KV/PV-frei. <br/>Kapitalauszahlungen werden über 120 Monate auf die GKV umgelegt.</span>
                  </div>
                  {contracts.filter(c => c.layer === 2).map(renderContractInput)}
                  <button onClick={() => addContract(2)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-medium text-sm hover:border-purple-400 hover:text-purple-600 flex items-center justify-center gap-2 transition-colors"><PlusCircle className="w-4 h-4" /> Vertrag hinzufügen</button>
                </div>
              )}

              {activeTab === 's3' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Private Renten</h3>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded flex items-center gap-1">
                        <Info className="w-3 h-3"/> Ertragsanteil: {(calculations.ertragsanteilRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    {contracts.filter(c => c.layer === 3).map(renderContractInput)}
                    <button onClick={() => addContract(3)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-medium text-sm hover:border-emerald-400 hover:text-emerald-600 flex items-center justify-center gap-2 transition-colors"><PlusCircle className="w-4 h-4" /> PRV hinzufügen</button>
                  </div>
                  <hr className="border-slate-200" />
                  <div className="bg-white p-4 rounded-lg border border-emerald-200 shadow-sm">
                    <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2"><PiggyBank className="w-4 h-4" /> Freies Depot (ETFs)</h3>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Aktuelles Kapital (€)</label><input type="number" value={privateCapital} onChange={e => setPrivateCapital(Number(e.target.value))} className="w-full border rounded p-2" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Sparrate (€/Monat)</label><input type="number" value={privateMonthly} onChange={e => setPrivateMonthly(Number(e.target.value))} className="w-full border rounded p-2" /></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-emerald-100">
                      <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Rendite Anspar. (%)</label><input type="number" step="0.1" value={expectedReturnAcc} onChange={e => setExpectedReturnAcc(Number(e.target.value))} className="w-full border border-emerald-100 rounded p-1.5 text-xs bg-emerald-50" /></div>
                      <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Rendite Entn. (%)</label><input type="number" step="0.1" value={expectedReturnWith} onChange={e => setExpectedReturnWith(Number(e.target.value))} className="w-full border border-emerald-100 rounded p-1.5 text-xs bg-emerald-50" /></div>
                      <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Kosten p.a. (TER %)</label><input type="number" step="0.01" value={etfTer} onChange={e => setEtfTer(Number(e.target.value))} className="w-full border border-emerald-100 rounded p-1.5 text-xs bg-emerald-50 text-rose-600" /></div>
                      <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Entnahme (%)</label><input type="number" step="0.1" value={withdrawalRate} onChange={e => setWithdrawalRate(Number(e.target.value))} className="w-full border border-emerald-100 rounded p-1.5 text-xs bg-emerald-50" /></div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-emerald-100">
                      <input type="checkbox" checked={includeEtfInNet} onChange={e => setIncludeEtfInNet(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-3 h-3" />
                      <label className="text-[10px] text-slate-600 font-medium cursor-pointer" onClick={() => setIncludeEtfInNet(!includeEtfInNet)}>ETF-Entnahmeplan ins Gesamt-Netto einrechnen</label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'planer' && (
                <div className="space-y-6">
                  <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200 shadow-sm">
                    <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-indigo-600" /> Liquiditäts- & Entnahmeplaner
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm space-y-4">
                        <div>
                          <div className="flex justify-between items-end mb-1">
                            <label className="block text-xs font-semibold text-slate-600">Start-Kapital zum Rentenbeginn (€)</label>
                            <button onClick={handleLoadPlaner} className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded hover:bg-indigo-200 transition-colors font-medium flex items-center gap-1">Aus Schicht 2+3 laden</button>
                          </div>
                          <input type="number" value={planerCapital} onChange={e => setPlanerCapital(Number(e.target.value))} className="w-full border border-slate-300 rounded p-2 bg-slate-50" />
                        </div>
                        <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
                          <div className="col-span-3 sm:col-span-1"><label className="block text-[10px] font-semibold text-slate-600 mb-1">Wunsch-Entnahme mtl.</label><input type="number" value={planerWithdrawal} onChange={e => setPlanerWithdrawal(Number(e.target.value))} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
                          <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Rendite p.a. (%)</label><input type="number" step="0.1" value={planerReturn} onChange={e => setPlanerReturn(Number(e.target.value))} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
                          <div><label className="block text-[10px] font-semibold text-slate-600 mb-1">Dynamik (%)</label><input type="number" step="0.1" value={planerDynamic} onChange={e => setPlanerDynamic(Number(e.target.value))} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
                        </div>
                        <div className="flex items-center gap-2 pt-3 border-t border-indigo-50">
                          <input type="checkbox" checked={includePlanerInNet} onChange={e => setIncludePlanerInNet(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3" />
                          <label className="text-[10px] text-indigo-800 font-medium cursor-pointer" onClick={() => setIncludePlanerInNet(!includePlanerInNet)}>Wunsch-Rente ins Gesamt-Netto übernehmen</label>
                        </div>
                      </div>
                      <div className="bg-indigo-900 rounded-lg p-5 text-white shadow-inner">
                        <div className="border-b border-indigo-700/50 pb-4 mb-4 flex justify-between items-center">
                          <div>
                            <div className="text-xs text-indigo-300 mb-1">Reicht bei {planerDynamic}% Dynamik für:</div>
                            <div className="font-bold text-lg text-emerald-400">{planerCalculations.lastsForever ? <><InfinityIcon className="w-4 h-4 inline" /> Jahre</> : `${planerCalculations.yearsLasted} Jahre`}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-indigo-300 mb-1">Depot leer im Alter von:</div>
                            <div className="font-bold text-lg text-rose-300">{planerCalculations.lastsForever ? '-' : planerCalculations.runOutAge}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 bg-white border-t border-slate-200">
              <button onClick={handleFileUpload} disabled={isUploading} className={`w-full border border-dashed rounded-lg p-3 flex justify-center items-center transition-colors text-sm font-medium ${isUploading ? 'bg-slate-50' : uploadSuccess ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-blue-50/50 text-blue-700 border-blue-200 hover:bg-blue-50'}`}>
                {isUploading ? 'Lade Daten...' : uploadSuccess ? 'Demo-Daten geladen!' : 'Demo-Portfolio laden (Für Schnell-Test)'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Dashboard & Results */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-6 print:col-span-12 print:w-full print:block">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden print:border-slate-300">
              <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp className="w-16 h-16" /></div>
              <h3 className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">
                 Zielbedarf (in {calculations.yearsToRetirement} Jahren)
                 {showRealValue && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded uppercase font-bold">Heute</span>}
              </h3>
              <div className="text-3xl font-bold text-slate-800">{formatResultCurrency(calculations.targetIncomeFuture)}</div>
              <p className="text-xs text-slate-400 mt-2">
                {showRealValue ? `Nominalwert bei Renteneintritt: ${formatCurrency(calculations.targetIncomeFuture)}` : `Inflationsbereinigt (Basis: ${formatCurrency(calculations.targetIncomeToday)})`}
              </p>
            </div>

            <div className={`bg-white rounded-xl shadow-sm border p-6 relative overflow-hidden ${calculations.gap > 0 ? 'border-rose-200' : 'border-emerald-200'} print:border-slate-300`}>
               <div className="absolute top-0 right-0 p-4 opacity-10"><AlertCircle className={`w-16 h-16 ${calculations.gap > 0 ? 'text-rose-600' : 'text-emerald-600'}`} /></div>
              <h3 className={`text-sm font-semibold mb-1 flex items-center gap-2 ${calculations.gap > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                 Rentenlücke (Netto)
                 {showRealValue && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded uppercase font-bold">Heute</span>}
              </h3>
              <div className={`text-3xl font-bold ${calculations.gap > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {calculations.gap > 0 ? formatResultCurrency(calculations.gap) : 'Gedeckt'}
              </div>
              <p className="text-xs text-slate-400 mt-2">Fehlender monatlicher Betrag</p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl shadow-lg p-5 text-slate-300 print:bg-slate-100 print:text-slate-800 print:shadow-none print:border print:border-slate-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white flex items-center gap-2 print:text-slate-800"><Calculator className="w-4 h-4 text-indigo-400 print:text-indigo-600" /> Progressions-Steuerengine 2026</h3>
              <div className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 flex gap-2 print:bg-white print:border print:border-slate-300 print:text-slate-600">
                <span>{isMarried ? 'Splitting' : 'Grundtarif'}</span>
                {hasChurchTax && <span className="text-indigo-300 print:text-indigo-600 ml-1">inkl. KiSt</span>}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm divide-x divide-slate-700 print:divide-slate-300">
              <div>
                <div className="text-xs text-slate-500 mb-1 print:text-slate-500">Zu versteuern</div>
                <div className="font-mono text-white print:text-slate-800 font-bold">{formatCurrency(calculations.zvE_yearly)}</div>
              </div>
              <div className="pl-4">
                <div className="text-xs text-slate-500 mb-1 print:text-slate-500">Ø-Steuersatz</div>
                <div className="font-mono text-indigo-400 print:text-indigo-700 font-bold">{(calculations.avgTaxRate * 100).toFixed(1)} %</div>
              </div>
              <div className="pl-4">
                <div className="text-xs text-slate-500 mb-1 print:text-slate-500">Grenzsteuer</div>
                <div className="font-mono text-rose-400 print:text-rose-700 font-bold">{(calculations.marginalTaxRate * 100).toFixed(1)} %</div>
              </div>
              <div className="pl-4">
                <div className="text-xs text-slate-500 mb-1 print:text-slate-500">Absetzbare KV</div>
                <div className="font-mono text-emerald-400 print:text-emerald-700 font-bold">{formatCurrency(calculations.deductible_kvpv * 12)}</div>
              </div>
            </div>
          </div>

          <div className="flex bg-slate-200/50 p-1 rounded-lg w-full mb-4 border border-slate-200 print:hidden">
            <button onClick={() => setRightView('zusammensetzung')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${rightView === 'zusammensetzung' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              <List className="w-4 h-4" /> Kassenbon & Netto
            </button>
            <button onClick={() => setRightView('verlauf')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${rightView === 'verlauf' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              <LineChartIcon className="w-4 h-4" /> Vermögensverlauf (Chart)
            </button>
          </div>

          <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:shadow-none print:border-slate-300 ${rightView === 'zusammensetzung' ? 'block' : 'hidden'} print:block print:break-inside-avoid`}>
            <h2 className="text-sm font-bold mb-4 text-slate-700">Zusammensetzung Ihres Gesamt-Nettos</h2>
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
                  <div className="flex items-center gap-3"><span className="font-bold">{formatResultCurrency(calculations.s1_net)}</span><ChevronDown className="w-4 h-4 text-slate-400 print:hidden" /></div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-blue-100 space-y-2 print:border-slate-300 ${expandedSections.s1 ? 'block' : 'hidden'} print:block`}>
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded print:border print:border-slate-200">
                    <div><span className="font-semibold block">Gesetzliche Rente</span><span className="text-[10px] text-slate-500">Brutto: {formatResultCurrency(calculations.grvFutureGross)}</span></div>
                    <div className="text-right"><span className="font-bold block">{formatResultCurrency(calculations.grvNet)}</span><span className="text-[10px] text-rose-500">KV/PV: {formatResultCurrency(calculations.grvKvpv)} | ESt{hasChurchTax ? '+KiSt' : ''}: {formatResultCurrency(calculations.grvESt + calculations.grvKist)}</span></div>
                  </div>
                  {calculations.contracts.filter(c => c.layer === 1).map(c => (
                    <div key={c.id} className="flex justify-between items-center bg-slate-50 p-2 rounded print:border print:border-slate-200">
                      <div><span className="font-semibold block">{c.name}</span><span className="text-[10px] text-slate-500">Brutto: {formatResultCurrency(c.gross)}</span></div>
                      <div className="text-right"><span className="font-bold block">{formatResultCurrency(c.net)}</span><span className="text-[10px] text-rose-500">ESt{hasChurchTax ? '+KiSt' : ''}: {formatResultCurrency(c.tax + (c.kist || 0))} (KV/PV-frei)</span></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-purple-100 rounded-lg overflow-hidden print:border-slate-300 print:break-inside-avoid">
                <div className="flex items-center justify-between p-3 bg-purple-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s2')}>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500 print:bg-slate-800"></div><span className="font-bold text-sm text-purple-900 print:text-slate-800">Schicht 2 (Zusatz)</span></div>
                  <div className="flex items-center gap-3"><span className="font-bold">{formatResultCurrency(calculations.s2_net)}</span><ChevronDown className="w-4 h-4 text-slate-400 print:hidden" /></div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-purple-100 space-y-2 print:border-slate-300 ${expandedSections.s2 ? 'block' : 'hidden'} print:block`}>
                  {calculations.contracts.filter(c => c.layer === 2).length === 0 && <div className="text-slate-400 italic">Keine Verträge in Schicht 2</div>}
                  {calculations.contracts.filter(c => c.layer === 2).map(c => (
                    <div key={c.id} className="flex justify-between items-center bg-slate-50 p-2 rounded print:border print:border-slate-200">
                      <div>
                        <span className="font-semibold block">{c.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {c.type === 'bavKapital' ? `bAV Kapitalauszahlung | Bruttokapital: ${formatResultCurrency(c.gross)}` : `${c.type === 'bav' ? 'bAV' : 'Riester'} | Brutto: ${formatResultCurrency(c.gross)}`}
                        </span>
                        {c.type === 'bavKapital' && <div className="text-[9px] text-purple-600 mt-1 font-medium">Berechnet nach Fünftelregelung & 120-Monats-KV-Regel</div>}
                      </div>
                      <div className="text-right">
                        <span className={`font-bold block ${c.type === 'bavKapital' && c.includeInNet === false ? 'text-slate-400' : ''}`}>
                          {c.type === 'bavKapital' && c.includeInNet === false ? formatResultCurrency(0) : formatResultCurrency(c.net)}
                        </span>
                        <span className="text-[10px] text-rose-500">
                          {c.type === 'bavKapital' && c.includeInNet === false ? 'Nicht angerechnet' : (
                            <>{c.kvpv_deduction > 0 ? `KV/PV: ${formatResultCurrency(c.kvpv_deduction)} | ` : ''}ESt{hasChurchTax ? '+KiSt' : ''}: {formatResultCurrency(c.tax + (c.kist || 0))}</>
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
                  <div className="flex items-center gap-3"><span className="font-bold">{formatResultCurrency(calculations.s3_net)}</span><ChevronDown className="w-4 h-4 text-slate-400 print:hidden" /></div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-emerald-100 space-y-2 print:border-slate-300 ${expandedSections.s3 ? 'block' : 'hidden'} print:block`}>
                  {calculations.contracts.filter(c => c.layer === 3).map(c => (
                    <div key={c.id} className="flex justify-between items-start bg-slate-50 p-2 rounded print:border print:border-slate-200">
                      <div>
                        <span className="font-semibold block">{c.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {c.type === 'prvRente' ? `Brutto: ${formatResultCurrency(c.gross)} (Ertragsanteil: ${Math.round(calculations.ertragsanteilRate * 100)}%)` : `Bruttokapital: ${formatResultCurrency(c.gross)}`}
                        </span>
                        {c.type === 'prvKapital' && <div className="text-[9px] text-indigo-500 mt-1 font-medium">Günstigerprüfung: {c.appliedTaxMethod}</div>}
                      </div>
                      <div className="text-right">
                        <span className={`font-bold block ${c.type === 'prvKapital' && c.includeInNet === false ? 'text-slate-400' : ''}`}>
                          {c.type === 'prvKapital' && c.includeInNet === false ? formatResultCurrency(0) : formatResultCurrency(c.net)}
                        </span>
                        <span className="text-[10px] text-rose-500">
                           {c.type === 'prvKapital' && c.includeInNet === false ? 'Nicht angerechnet' : `Steuerlast${hasChurchTax ? ' inkl. KiSt' : ''}: ${formatResultCurrency(c.tax + (c.kist || 0))}`}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded border-l-2 border-emerald-300 print:border-slate-400">
                    <div><span className="font-semibold block">ETF / freies Depot</span><span className="text-[10px] text-slate-500">Endkapital: {formatResultCurrency(calculations.etfTotalCapital)}</span></div>
                    <div className="text-right">
                      <span className={`font-bold block ${!includeEtfInNet ? 'text-slate-400' : ''}`}>
                        {includeEtfInNet ? formatResultCurrency(calculations.etfNet) : formatResultCurrency(0)}
                      </span>
                      <span className="text-[10px] text-rose-500">
                        {!includeEtfInNet ? 'Nicht angerechnet' : `Abgeltung${hasChurchTax ? '+KiSt' : ''}: ${formatResultCurrency(calculations.etfGrossMonthly - calculations.etfNet)}`}
                      </span>
                    </div>
                  </div>

                  {includePlanerInNet && (
                    <div className="flex justify-between items-center bg-indigo-50 p-2 rounded border-l-2 border-indigo-400 mt-2 print:border-slate-400">
                      <div><span className="font-semibold text-indigo-900 print:text-slate-800 block">Planer Wunsch-Rente</span><span className="text-[10px] text-indigo-700 print:text-slate-600">Manuelle Entnahme aus Kapital</span></div>
                      <div className="text-right"><span className="font-bold text-indigo-900 print:text-slate-800 block">{formatResultCurrency(planerWithdrawal)}</span></div>
                    </div>
                  )}
                </div>
              </div>

               <div className="flex items-center justify-between p-4 mt-4 rounded-lg bg-slate-900 text-white shadow-md print:bg-slate-800 print:shadow-none print:break-inside-avoid">
                <div className="font-bold text-lg">Erwartetes Gesamt-Netto</div>
                <div className="font-bold text-xl text-emerald-400 print:text-white">{formatResultCurrency(calculations.totalNetFuture)}</div>
              </div>
            </div>
          </div>

          <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:shadow-none print:border-slate-300 relative h-[480px] print:h-auto print:mt-12 print:break-inside-avoid ${rightView === 'verlauf' ? 'block' : 'hidden'} print:block`}>
            <h2 className="text-sm font-bold mb-2 text-slate-700 print:text-lg">Kapitalverlauf in der Entnahmephase</h2>
            <p className="text-xs text-slate-500 mb-6 print:text-sm">
              Das Diagramm zeigt, wie sich das Kapital ab Renteneintritt (Alter {retirementAge}) durch Entnahmen und Verzinsung entwickelt.
              {showRealValue && <span className="font-semibold text-emerald-600 print:text-slate-800 ml-1">Kaufkraft-Bereinigung aktiv.</span>}
            </p>

            <div className="w-full h-[350px] relative" onMouseLeave={() => setHoveredData(null)}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
                {yTicks.map((val, i) => (
                  <g key={`y-${i}`}>
                    <line x1={paddingX} y1={getY(val)} x2={svgWidth - paddingX} y2={getY(val)} stroke="#f1f5f9" strokeWidth="1" className="print:stroke-slate-200" />
                    <text x={paddingX - 10} y={getY(val) + 4} fontSize="11" fill="#94a3b8" textAnchor="end" fontWeight="500" className="print:fill-slate-600">
                      {formatYAxis(val)}
                    </text>
                  </g>
                ))}
                
                {calculations.chartData.filter((d, i) => d.age % 5 === 0 || i === 0 || i === calculations.chartData.length - 1).map((d) => {
                  const origIndex = calculations.chartData.indexOf(d);
                  return (
                    <g key={`x-${d.age}`}>
                      <text x={getX(origIndex)} y={svgHeight - 15} fontSize="11" fill="#94a3b8" textAnchor="middle" fontWeight="500" className="print:fill-slate-600">
                        {d.age} J.
                      </text>
                      <line x1={getX(origIndex)} y1={svgHeight - bottomPadding} x2={getX(origIndex)} y2={svgHeight - bottomPadding + 5} stroke="#cbd5e1" className="print:stroke-slate-400" />
                    </g>
                  );
                })}

                <line x1={paddingX} y1={svgHeight - bottomPadding} x2={svgWidth - paddingX} y2={svgHeight - bottomPadding} stroke="#cbd5e1" strokeWidth="2" className="print:stroke-slate-400" />

                {calculations.etfTotalCapital > 0 && (
                   <path d={etfPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {planerCalculations.nettoVerrentungsKapital > 0 && (
                   <path d={planerPath} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" />
                )}

                {calculations.chartData.map((d, i) => {
                  const rectWidth = (svgWidth - paddingX * 2) / (calculations.chartData.length - 1);
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
                  <line 
                    x1={getX(hoveredData.index)} y1={paddingY} 
                    x2={getX(hoveredData.index)} y2={svgHeight - bottomPadding} 
                    stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" 
                    className="pointer-events-none print:hidden"
                  />
                )}
              </svg>

              <div className="absolute top-0 right-4 flex gap-4 text-xs font-semibold bg-white/80 p-2 rounded backdrop-blur-sm print:bg-white">
                <div className="flex items-center gap-1.5 text-emerald-600 print:text-slate-800"><div className="w-3 h-1 bg-emerald-500 rounded"></div> ETF Depot</div>
                <div className="flex items-center gap-1.5 text-indigo-600 print:text-slate-800"><div className="w-3 h-1 border-b-2 border-indigo-500 border-dashed rounded"></div> Entnahme-Planer</div>
              </div>

              {hoveredData && (
                <div className="absolute bg-slate-900 text-white p-3 rounded-lg shadow-xl text-sm z-10 pointer-events-none transition-all duration-75 border border-slate-700 min-w-[180px] print:hidden" 
                  style={{ top: '10%', ...(hoveredData.index > calculations.chartData.length / 2 ? { right: `${100 - ((getX(hoveredData.index) / svgWidth) * 100) + 2}%` } : { left: `${(getX(hoveredData.index) / svgWidth) * 100 + 2}%` }) }}
                >
                   <div className="font-bold border-b border-slate-700 pb-1.5 mb-2 flex items-center gap-2"><Clock className="w-3 h-3 text-slate-400" /> Alter: {hoveredData.age} Jahre</div>
                   <div className="space-y-1.5">
                     <div className="flex justify-between items-center gap-4 text-emerald-400"><span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> ETF</span><span className="font-mono">{formatChartCurrency(hoveredData.etf, hoveredData.discount)}</span></div>
                     <div className="flex justify-between items-center gap-4 text-indigo-400"><span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Planer</span><span className="font-mono">{formatChartCurrency(hoveredData.planer, hoveredData.discount)}</span></div>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}