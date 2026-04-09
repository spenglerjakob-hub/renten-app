import React, { useState, useMemo, useRef } from 'react';
import { 
  Upload, FileText, TrendingUp, AlertCircle, Calculator, 
  CheckCircle, ChevronDown, ChevronUp, ShieldAlert, PiggyBank, 
  Briefcase, PlusCircle, Trash, Users, User, Info, Coins, Clock, Infinity as InfinityIcon, Wallet, Activity,
  LineChart as LineChartIcon, List, Download, Home, Save, FolderOpen, Zap
} from 'lucide-react';

// --- STEUER-ENGINE (EStG Formel Approximation 2026) ---
const calculateESt = (zve, isMarried) => {
  let x = isMarried ? zve / 2 : zve;
  x = Math.max(0, x - 744); 
  
  let tax = 0;
  if (x <= 11604) tax = 0;
  else if (x <= 17005) { const y = (x - 11604) / 10000; tax = (922.98 * y + 1400) * y; }
  else if (x <= 62809) { const z = (x - 17005) / 10000; tax = (208.91 * z + 2397) * z + 940.14; }
  else if (x <= 277825) tax = 0.42 * x - 9972.98;
  else tax = 0.45 * x - 18307.73;

  return isMarried ? tax * 2 : tax;
};

// --- Ertragsanteils-Tabelle ---
const getErtragsanteil = (age) => {
  const tabelle = { 60: 0.22, 61: 0.22, 62: 0.21, 63: 0.20, 64: 0.19, 65: 0.18, 66: 0.18, 67: 0.17, 68: 0.16, 69: 0.15, 70: 0.15, 71: 0.14, 72: 0.14, 73: 0.13, 74: 0.13, 75: 0.12 };
  if (age < 60) return 0.22; if (age > 75) return 0.11; return tabelle[age] || 0.17;
};

// --- GRV Abschläge (0,3% pro Monat vor 67, max 14,4%) ---
const getGrvAbschlag = (retAgeExact) => {
  if (retAgeExact >= 67) return 0;
  const monthsEarly = Math.ceil((67 - retAgeExact) * 12);
  return Math.min(0.144, monthsEarly * 0.003);
};

// Helper für exakte Datumsdifferenzen inkl. Tag, Monat, Jahr
const parseDateValues = (str) => {
    if (!str) return null;
    if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 3 && parts[2].length === 4) {
            return { d: Number(parts[0]), m: Number(parts[1]), y: Number(parts[2]) };
        }
    } else if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length >= 2) {
             return { y: Number(parts[0]), m: Number(parts[1]), d: 1 };
        }
    }
    return null;
};

const diffInYears = (startStr, endStr) => {
  const v1 = parseDateValues(startStr);
  const v2 = parseDateValues(endStr);
  if (!v1 || !v2) return 0;
  return (v2.y - v1.y) + (v2.m - v1.m) / 12 + (v2.d - v1.d) / 365.25;
};

const getCurrentDateStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

// Input-Maske: Setzt automatisch die Punkte DD.MM.YYYY
const formatDateInput = (value) => {
  const cleaned = value.replace(/\D/g, '');
  let formatted = '';
  if (cleaned.length > 0) formatted += cleaned.substring(0, 2);
  if (cleaned.length > 2) formatted += '.' + cleaned.substring(2, 4);
  if (cleaned.length > 4) formatted += '.' + cleaned.substring(4, 8);
  return formatted;
};

export default function App() {
  // --- STATE MANAGEMENT ---
  const [isMarried, setIsMarried] = useState(false); 
  const [showRealValue, setShowRealValue] = useState(false);
  const [targetIncomeToday, setTargetIncomeToday] = useState(3000); 
  const [hasChurchTax, setHasChurchTax] = useState(false);
  const [hasChildren, setHasChildren] = useState(true);
  const [kvStatus, setKvStatus] = useState('kvdr'); 
  const [pkvPremium, setPkvPremium] = useState(600);

  // Person A
  const [birthDateA, setBirthDateA] = useState('01.01.1989');
  const [retDateA, setRetDateA] = useState('01.01.2056');
  const [grvGrossA, setGrvGrossA] = useState(0);
  
  // Person B (Partner)
  const [birthDateB, setBirthDateB] = useState('01.01.1991');
  const [retDateB, setRetDateB] = useState('01.01.2058');
  const [grvGrossB, setGrvGrossB] = useState(0);

  const [grvIncreaseRate, setGrvIncreaseRate] = useState(1.5);

  // Indexierung & Makro
  const [inflationRate, setInflationRate] = useState(2.0);
  const [taxIndexRate, setTaxIndexRate] = useState(2.0);
  const [solutionSavingsReturn, setSolutionSavingsReturn] = useState(5.0);
  const [solutionSavingsDynamic, setSolutionSavingsDynamic] = useState(3.0);

  // Verträge
  const [contracts, setContracts] = useState([]);

  // UI States
  const [activeTab, setActiveTab] = useState('s1');
  const [personTab, setPersonTab] = useState('A'); 
  const [expandedSections, setExpandedSections] = useState({ s1: true, s2: true, s3: true });
  const [rightView, setRightView] = useState('zusammensetzung'); 
  const [hoveredData, setHoveredData] = useState(null); 
  const [showTaxInfo, setShowTaxInfo] = useState(false); 

  // --- NEU: RENTEN-SCHÄTZER STATES & LOGIK ---
  const [estimatorPerson, setEstimatorPerson] = useState(null);
  const [estimatorSalary, setEstimatorSalary] = useState(50000);

  const estimatedPension = useMemo(() => {
    if (!estimatorPerson) return 0;
    const birthDate = estimatorPerson === 'A' ? birthDateA : birthDateB;
    const retDate = estimatorPerson === 'A' ? retDateA : retDateB;
    const currentMonth = getCurrentDateStr();
    
    const currentAge = Math.max(0, diffInYears(birthDate, currentMonth));
    const retAge = Math.max(0, diffInYears(birthDate, retDate));
    
    let totalPunkte = 0;
    const startAge = 22;
    const endAge = Math.floor(retAge);
    
    if (endAge <= startAge) return 0;
    
    // Karriere-Kurve: Gehalt steigt von 22 bis exakt zum *heutigen* Alter
    const growthEndAge = Math.max(startAge, Math.floor(currentAge));
    const yearsOfGrowth = growthEndAge - startAge;
    
    for (let age = startAge; age < endAge; age++) {
       let yearSalary = estimatorSalary;
       
       if (age < growthEndAge && yearsOfGrowth > 0) {
           // Einstiegsgehalt = 50% vom heutigen Zielgehalt, exponentielles Wachstum
           const startRatio = 0.5;
           const growthRate = Math.pow(1 / startRatio, 1 / yearsOfGrowth) - 1;
           yearSalary = estimatorSalary * startRatio * Math.pow(1 + growthRate, age - startAge);
       }
       
       const cappedSalary = Math.min(yearSalary, 101400); // Beitragsbemessungsgrenze 2026 West
       totalPunkte += cappedSalary / 50493; // Durchschnittsentgelt 
    }
    
    return Math.round(totalPunkte * 42.52); // Aktueller Rentenwert 2026
  }, [estimatorSalary, estimatorPerson, birthDateA, birthDateB, retDateA, retDateB]);

  const openEstimator = (person) => {
    setEstimatorPerson(person);
  };

  const [planerCapital, setPlanerCapital] = useState(250000);
  const [planerWithdrawal, setPlanerWithdrawal] = useState(1000);
  const [planerReturn, setPlanerReturn] = useState(3.0);
  const [planerDynamic, setPlanerDynamic] = useState(2.0);
  const [includePlanerInNet, setIncludePlanerInNet] = useState(false);

  const fileInputRef = useRef(null);

  const toggleSection = (sec) => setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));

  const handleBirthDateChange = (val, person) => {
     const formatted = formatDateInput(val);
     if (person === 'A') {
         setBirthDateA(formatted);
         // Auto-Ausfüllen des Rentenbeginns auf Alter 67
         if (formatted.length === 10) {
             const y = parseInt(formatted.substring(6, 10), 10);
             const m = formatted.substring(3, 5);
             const d = formatted.substring(0, 2);
             setRetDateA(`${d}.${m}.${y + 67}`);
         }
     } else {
         setBirthDateB(formatted);
         if (formatted.length === 10) {
             const y = parseInt(formatted.substring(6, 10), 10);
             const m = formatted.substring(3, 5);
             const d = formatted.substring(0, 2);
             setRetDateB(`${d}.${m}.${y + 67}`);
         }
     }
  };

  const handleRetDateChange = (val, person) => {
     const formatted = formatDateInput(val);
     if (person === 'A') setRetDateA(formatted);
     else setRetDateB(formatted);
  };

  // --- EXPORT & IMPORT (Session Management) ---
  const handleExport = () => {
    const data = { 
      isMarried, targetIncomeToday, hasChurchTax, hasChildren, kvStatus, pkvPremium, 
      birthDateA, retDateA, grvGrossA, 
      birthDateB, retDateB, grvGrossB, 
      grvIncreaseRate, inflationRate, taxIndexRate, 
      solutionSavingsReturn, solutionSavingsDynamic, contracts, planerCapital, planerWithdrawal, planerReturn, planerDynamic, includePlanerInNet 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vorsorge_Profil_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const currentYear = new Date().getFullYear();

        const convertToNewFormat = (str) => {
            if (!str) return '';
            if (str.includes('.')) return str;
            if (str.includes('-')) {
                const [y, m] = str.split('-');
                return `01.${m.padStart(2, '0')}.${y}`;
            }
            return str;
        };

        if (data.birthDateA) setBirthDateA(data.birthDateA);
        else if (data.birthMonthA) setBirthDateA(convertToNewFormat(data.birthMonthA));
        else if (data.currentAgeA) setBirthDateA(`01.01.${currentYear - data.currentAgeA}`);

        if (data.retDateA) setRetDateA(data.retDateA);
        else if (data.retMonthA) setRetDateA(convertToNewFormat(data.retMonthA));
        else if (data.retirementAgeA && data.currentAgeA) setRetDateA(`01.01.${currentYear + (data.retirementAgeA - data.currentAgeA)}`);

        if (data.birthDateB) setBirthDateB(data.birthDateB);
        else if (data.birthMonthB) setBirthDateB(convertToNewFormat(data.birthMonthB));
        else if (data.currentAgeB) setBirthDateB(`01.01.${currentYear - data.currentAgeB}`);

        if (data.retDateB) setRetDateB(data.retDateB);
        else if (data.retMonthB) setRetDateB(convertToNewFormat(data.retMonthB));
        else if (data.retirementAgeB && data.currentAgeB) setRetDateB(`01.01.${currentYear + (data.retirementAgeB - data.currentAgeB)}`);

        if (data.isMarried !== undefined) setIsMarried(data.isMarried);
        if (data.targetIncomeToday) setTargetIncomeToday(data.targetIncomeToday);
        if (data.contracts) setContracts(data.contracts);
        if (data.grvGrossA !== undefined) setGrvGrossA(data.grvGrossA);
        if (data.grvGrossB !== undefined) setGrvGrossB(data.grvGrossB);
        if (data.inflationRate) setInflationRate(data.inflationRate);
        
        alert("Profil erfolgreich geladen!");
      } catch (err) {
        alert("Fehler beim Laden der Datei. Bitte prüfen Sie das Format.");
      }
    };
    reader.readAsText(file);
  };

  const loadDemoData = () => {
    setBirthDateA('01.01.1991'); setBirthDateB('01.01.1993'); 
    setRetDateA('01.01.2058'); setRetDateB('01.01.2060'); 
    setGrvGrossA(1650); setGrvGrossB(800); setIsMarried(true); setKvStatus('kvdr'); setHasChurchTax(true);
    setContracts([
      { id: 1, layer: 1, type: 'basis', name: 'Rürup Rente (A)', gross: 300, owner: 'A' },
      { id: 2, layer: 2, type: 'bav', name: 'bAV Direkt (A)', gross: 250, owner: 'A' },
      { id: 3, layer: 2, type: 'riester', name: 'Fonds-Riester (B)', gross: 150, owner: 'B' },
      { id: 8, layer: 3, type: 'etf', name: 'Gemeinsames ETF-Depot', capital: 45000, monthly: 350, returnAcc: 6.0, returnWith: 3.5, ter: 0.2, withdrawalRate: 4.0, includeInNet: true, specialPayment: 50000, specialPaymentYear: 2035, owner: 'A' }
    ]);
  };

  const addContract = (layer) => {
    const newId = Date.now();
    let defaultType = layer === 1 ? 'basis' : layer === 2 ? 'bav' : 'prvRente';
    let newContract = { id: newId, layer, type: defaultType, name: 'Neuer Vertrag', gross: 0, owner: personTab };
    if (defaultType === 'prvKapital') newContract = { ...newContract, startYear: new Date().getFullYear() - 5, monthlyPremium: 100, dynamic: 3, includeInNet: true };
    if (defaultType === 'bavKapital') newContract = { ...newContract, includeInNet: true };
    setContracts([...contracts, newContract]);
  };

  const updateContract = (id, field, value) => setContracts(contracts.map(c => c.id === id ? { ...c, [field]: value } : c));
  const removeContract = (id) => setContracts(contracts.filter(c => c.id !== id));

  const handleContractTypeChange = (id, newType) => {
    setContracts(contracts.map(c => {
        if (c.id === id) {
            let updates = { type: newType, gross: c.gross || 0 };
            if (newType === 'immobilie') { updates.costs = 20; updates.dynamic = 1.5; }
            if (newType === 'etf') { updates.capital = 0; updates.monthly = 100; updates.returnAcc = 6.0; updates.returnWith = 3.0; updates.ter = 0.2; updates.withdrawalRate = 4.0; updates.includeInNet = true; updates.specialPayment = 0; updates.specialPaymentYear = new Date().getFullYear() + 10; }
            return { ...c, ...updates };
        }
        return c;
    }));
  };

  // --- BERECHNUNGSLOGIK (Inkl. Person A & B) ---
  const calculations = useMemo(() => {
    const currentMonth = getCurrentDateStr();
    const currentYear = new Date().getFullYear();

    const currentAgeA = Math.max(0, diffInYears(birthDateA, currentMonth));
    const currentAgeB = Math.max(0, diffInYears(birthDateB, currentMonth));
    
    const retirementAgeA = Math.max(0, diffInYears(birthDateA, retDateA));
    const retirementAgeB = Math.max(0, diffInYears(birthDateB, retDateB));

    const yearsToRetA = Math.max(0, diffInYears(currentMonth, retDateA));
    const yearsToRetB = Math.max(0, diffInYears(currentMonth, retDateB));
    const maxYearsToRet = isMarried ? Math.max(yearsToRetA, yearsToRetB) : yearsToRetA; 
    
    const inflationFactor = Math.pow(1 + inflationRate / 100, maxYearsToRet);
    const targetIncomeFuture = targetIncomeToday * inflationFactor; 
    
    const getYearFromStr = (str) => {
        const vals = parseDateValues(str);
        return vals ? vals.y : currentYear;
    };

    const retirementYearA = getYearFromStr(retDateA);
    const retirementYearB = getYearFromStr(retDateB);
    const baseRetYear = isMarried ? Math.max(retirementYearA, retirementYearB) : retirementYearA;

    const ertragsanteilRateA = getErtragsanteil(Math.floor(retirementAgeA));
    const ertragsanteilRateB = getErtragsanteil(Math.floor(retirementAgeB));
    
    const taxBasePercentA = Math.min(1.0, 0.84 + (Math.max(0, retirementYearA - 2026) * 0.005));
    const taxBasePercentB = Math.min(1.0, 0.84 + (Math.max(0, retirementYearB - 2026) * 0.005));
    
    const kistRate = hasChurchTax ? 0.08 : 0;
    const kvRateFull = 0.175; 
    const kvRateHalf = kvRateFull / 2; 
    const pvRateFull = hasChildren ? 0.036 : 0.042;
    
    const wageGrowthFactor = Math.pow(1 + taxIndexRate / 100, maxYearsToRet); 
    const bavFreibetragKV = 197.75 * wageGrowthFactor; 
    const BBG_KV = 5812.50 * wageGrowthFactor; 

    // GRV Abschläge anwenden
    const grvFutureGrossA_raw = grvGrossA * Math.pow(1 + grvIncreaseRate / 100, yearsToRetA);
    const grvFutureGrossA = grvFutureGrossA_raw * (1 - getGrvAbschlag(retirementAgeA));
    
    const grvFutureGrossB_raw = grvGrossB * Math.pow(1 + grvIncreaseRate / 100, yearsToRetB);
    const grvFutureGrossB = isMarried ? (grvFutureGrossB_raw * (1 - getGrvAbschlag(retirementAgeB))) : 0;

    const grvFutureGrossTotal = grvFutureGrossA + grvFutureGrossB;

    const rentenFreibetragA = grvFutureGrossA * (1 - taxBasePercentA); 
    const rentenFreibetragB = grvFutureGrossB * (1 - taxBasePercentB); 
    let zvE_total = (grvFutureGrossA - rentenFreibetragA) + (grvFutureGrossB - rentenFreibetragB);

    let deductible_kvpv = 0;
    let grvKvpv = 0;
    let remainingBBG = isMarried ? BBG_KV * 2 : BBG_KV; 

    if (kvStatus === 'pkv') {
      const grvSubsidy = Math.min(grvFutureGrossTotal, remainingBBG) * kvRateHalf; 
      grvKvpv = Math.max(0, pkvPremium - grvSubsidy); 
      deductible_kvpv = pkvPremium * 0.8; 
    } else if (kvStatus === 'kvdr') {
      const grvBeitragspflichtig = Math.min(grvFutureGrossTotal, remainingBBG);
      grvKvpv = grvBeitragspflichtig * (kvRateHalf + pvRateFull);
      deductible_kvpv += grvKvpv;
    } else if (kvStatus === 'freiwillig') {
      const grvBeitragspflichtig = Math.min(grvFutureGrossTotal, remainingBBG);
      grvKvpv = grvBeitragspflichtig * (kvRateHalf + pvRateFull);
      deductible_kvpv += grvKvpv;
      remainingBBG -= grvBeitragspflichtig;
    }

    const processedContracts = contracts.map(c => {
      let zvE_contribution = 0;
      let kvpv_deduction = 0;
      let incomeForKV = 0;
      const cRetAge = c.owner === 'B' && isMarried ? retirementAgeB : retirementAgeA;
      const cYearsToRet = c.owner === 'B' && isMarried ? yearsToRetB : yearsToRetA;
      const cRetYear = c.owner === 'B' && isMarried ? retirementYearB : retirementYearA;
      const cErtRate = c.owner === 'B' && isMarried ? ertragsanteilRateB : ertragsanteilRateA;
      const cTaxBase = c.owner === 'B' && isMarried ? taxBasePercentB : taxBasePercentA;

      if (c.type === 'basis') {
        zvE_contribution = c.gross - (c.gross * (1 - cTaxBase)); 
        if (kvStatus === 'freiwillig') incomeForKV = c.gross;
      } 
      else if (c.type === 'bav') {
        zvE_contribution = c.gross; 
        if (kvStatus === 'kvdr') {
          const bav_kv = Math.max(0, c.gross - bavFreibetragKV) * kvRateFull;
          const bav_pv = c.gross > bavFreibetragKV ? c.gross * pvRateFull : 0;
          kvpv_deduction = bav_kv + bav_pv;
          deductible_kvpv += kvpv_deduction;
        } else if (kvStatus === 'freiwillig') incomeForKV = c.gross; 
      }
      else if (c.type === 'riester') {
        zvE_contribution = c.gross; 
        if (kvStatus === 'freiwillig') incomeForKV = 0; 
      }
      else if (c.type === 'prvRente') {
        zvE_contribution = c.gross * cErtRate; 
        if (kvStatus === 'freiwillig') incomeForKV = c.gross; 
      }
      else if (c.type === 'immobilie') {
        const futureGross = c.gross * Math.pow(1 + (c.dynamic || 0) / 100, maxYearsToRet);
        const taxableRent = futureGross * (1 - (c.costs !== undefined ? c.costs : 20) / 100);
        c.futureGross = futureGross;
        c.taxableRent = taxableRent;
        zvE_contribution = taxableRent; 
        if (kvStatus === 'freiwillig') incomeForKV = taxableRent; 
      }
      else if (c.type === 'etf') {
        const netReturnAcc = Math.max(0, (c.returnAcc || 0) - (c.ter || 0));
        const r_monthly_acc = (netReturnAcc / 100) / 12;
        const months = maxYearsToRet * 12;
        
        let cap = (c.capital || 0) * Math.pow(1 + (netReturnAcc/100), maxYearsToRet) + ((c.monthly || 0) > 0 ? (c.monthly || 0) * ((Math.pow(1 + r_monthly_acc, months) - 1) / r_monthly_acc) : 0);
        
        if (c.specialPayment > 0 && c.specialPaymentYear > currentYear) {
            const yearsInvested = baseRetYear - c.specialPaymentYear;
            if (yearsInvested > 0) cap += c.specialPayment * Math.pow(1 + (netReturnAcc/100), yearsInvested);
            else cap += c.specialPayment; 
        }

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
      return { ...c, zvE_contribution, kvpv_deduction, cRetYear };
    });

    // --- STEUER-ENGINE ---
    const taxInflationFactor = wageGrowthFactor;
    const zvE_yearly_nominal = Math.max(0, zvE_total * 12 - (deductible_kvpv * 12));
    const zvE_yearly_today = zvE_yearly_nominal / taxInflationFactor;
    
    const tax_today = calculateESt(zvE_yearly_today, isMarried);
    const yearlyESt = tax_today * taxInflationFactor; 
    
    const avgTaxRate = zvE_yearly_nominal > 0 ? (yearlyESt / (zvE_total * 12)) : 0;
    const marginalTaxToday = (calculateESt(zvE_yearly_today + 100, isMarried) - tax_today) / 100;

    const grvESt = (grvFutureGrossTotal - rentenFreibetragA - rentenFreibetragB) * avgTaxRate;
    const grvKist = grvESt * kistRate;
    const grvNet = Math.max(0, grvFutureGrossTotal - grvKvpv - grvESt - grvKist);
    
    let s1_net = grvNet;
    let s2_net = 0;
    let s3_net = 0;

    const finalizedContracts = processedContracts.map(c => {
      let net = 0, tax = 0, kist = 0;
      if (c.type === 'basis' || c.type === 'bav' || c.type === 'riester' || c.type === 'prvRente') {
        tax = c.zvE_contribution * avgTaxRate;
        kist = tax * kistRate;
        net = c.gross - c.kvpv_deduction - tax - kist;
        if (c.type === 'basis') s1_net += net;
        else if (c.type === 'prvRente') s3_net += net;
        else s2_net += net;
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
        net = (c.netCapital * ((c.withdrawalRate || 4) / 100)) / 12; 
        if (c.includeInNet !== false) s2_net += net;
      }
      else if (c.type === 'prvKapital') {
        let totalPremiums = 0;
        const years = Math.max(0, c.cRetYear - (c.startYear || 2010));
        let currPremium = (c.monthlyPremium || 0) * 12;
        for (let i = 0; i < years; i++) { totalPremiums += currPremium; currPremium *= (1 + (c.dynamic || 0) / 100); }
        const profit = Math.max(0, c.gross - totalPremiums);
        const taxHalb = profit * 0.5 * 0.85 * marginalTaxToday;
        const kistHalb = taxHalb * kistRate;
        const abgeltungRate = hasChurchTax ? 0.278186 : 0.26375;
        const taxAbgeltung = profit * 0.85 * abgeltungRate;
        if ((taxHalb + kistHalb) < taxAbgeltung) { tax = taxHalb; kist = kistHalb; c.appliedTaxMethod = 'Halbeinkünfte'; } 
        else { tax = taxAbgeltung; kist = 0; c.appliedTaxMethod = 'Abgeltungsteuer'; }
        
        let monthlyKvPv = 0;
        if (kvStatus === 'freiwillig') {
           const anrechenbar = Math.min(profit / 120, Math.max(0, remainingBBG));
           monthlyKvPv = anrechenbar * (kvRateFull + pvRateFull);
           remainingBBG -= anrechenbar;
        }
        c.kvpv_deduction = monthlyKvPv * 120;
        c.netCapital = Math.max(0, c.gross - tax - kist - c.kvpv_deduction);
        net = (c.netCapital * ((c.withdrawalRate || 4) / 100)) / 12;
        if (c.includeInNet !== false) s3_net += net;
      }
      else if (c.type === 'immobilie') {
        tax = c.taxableRent * avgTaxRate;
        kist = tax * kistRate;
        net = c.taxableRent - c.kvpv_deduction - tax - kist;
        if (c.includeInNet !== false) s3_net += net;
      }
      else if (c.type === 'etf') {
        const taxableBase = c.grossMonthly * 0.7; 
        tax = taxableBase * 0.25; 
        kist = hasChurchTax ? taxableBase * 0.08 : 0;
        const soli = tax * 0.055;
        tax += soli;
        
        net = c.grossMonthly - c.kvpv_deduction - tax - kist;
        if (c.includeInNet !== false) s3_net += net;
      }
      return { ...c, net, tax, kist };
    });

    if (includePlanerInNet) s3_net += planerWithdrawal;

    const gap = Math.max(0, targetIncomeFuture - (s1_net + s2_net + s3_net));

    const r_ret = (2.0 / 100) / 12;
    const n_ret = 25 * 12;
    let requiredCapital = gap > 0 ? (r_ret > 0 ? gap * (1 - Math.pow(1 + r_ret, -n_ret)) / r_ret : gap * n_ret) : 0;

    const dyn = solutionSavingsDynamic / 100;
    const r_m = (solutionSavingsReturn / 100) / 12;
    let requiredSavings = 0;
    if (requiredCapital > 0 && maxYearsToRet > 0) {
      if (r_m > 0) {
        if (dyn === 0) requiredSavings = requiredCapital * r_m / (Math.pow(1 + r_m, maxYearsToRet * 12) - 1);
        else {
          const r_a = Math.pow(1 + r_m, 12) - 1; 
          const C = (Math.pow(1 + r_m, 12) - 1) / r_m; 
          if (Math.abs(r_a - dyn) < 0.00001) requiredSavings = requiredCapital / (C * maxYearsToRet * Math.pow(1 + r_a, maxYearsToRet - 1));
          else requiredSavings = requiredCapital / (C * ((Math.pow(1 + r_a, maxYearsToRet) - Math.pow(1 + dyn, maxYearsToRet)) / (r_a - dyn)));
        }
      } else { 
        if (dyn === 0) requiredSavings = requiredCapital / (maxYearsToRet * 12);
        else requiredSavings = requiredCapital / (12 * ((Math.pow(1 + dyn, maxYearsToRet) - 1) / dyn));
      }
    }
    
    const lumpSumRequired = requiredCapital > 0 ? requiredCapital / Math.pow(1 + (solutionSavingsReturn/100), maxYearsToRet) : 0;

    let etfSims = finalizedContracts.filter(c => c.type === 'etf' && c.includeInNet !== false).map(c => ({ cap: c.totalCap, returnWithRate: Math.max(0, (c.returnWith || 0) - (c.ter || 0)), with: c.grossMonthly * 12 }));
    const chartData = [];
    let curPlanerChart = Math.max(0, planerCapital), curPlanerWithChart = planerWithdrawal * 12;
    
    const startAgeChart = Math.floor(Math.min(retirementAgeA, isMarried ? retirementAgeB : retirementAgeA));
    for (let age = startAgeChart; age <= 100; age++) {
      let currentEtfTotal = etfSims.reduce((sum, sim) => sum + Math.max(0, sim.cap), 0);
      chartData.push({ age, etf: currentEtfTotal, planer: Math.max(0, curPlanerChart), discount: Math.pow(1 + inflationRate / 100, age - (isMarried ? Math.min(currentAgeA, currentAgeB) : currentAgeA)) });
      etfSims.forEach(sim => { if (sim.cap > 0) { sim.cap = sim.cap * (1 + sim.returnWithRate / 100) - sim.with; sim.with *= (1 + inflationRate / 100); } });
      if (curPlanerChart > 0) curPlanerChart = curPlanerChart * (1 + planerReturn / 100) - curPlanerWithChart;
      curPlanerWithChart *= (1 + planerDynamic / 100);
    }

    return {
      currentAgeA, currentAgeB, retirementAgeA, retirementAgeB,
      yearsToRetA, yearsToRetB, maxYearsToRet, targetIncomeFuture, baseRetYear,
      inflationFactor, chartData, zvE_yearly: zvE_yearly_nominal, avgTaxRate, marginalTaxRate: marginalTaxToday, deductible_kvpv, 
      grvFutureGrossTotal, grvNet, grvKvpv, grvESt, grvKist, s1_net, s2_net, s3_net, contracts: finalizedContracts,
      totalNetFuture: s1_net + s2_net + s3_net, gap, requiredCapital, requiredSavings, lumpSumRequired,
      grvDiscountA: getGrvAbschlag(retirementAgeA), grvDiscountB: getGrvAbschlag(retirementAgeB)
    };
  }, [
    birthDateA, retDateA, grvGrossA, birthDateB, retDateB, grvGrossB,
    targetIncomeToday, hasChildren, isMarried, kvStatus, pkvPremium, hasChurchTax,
    grvIncreaseRate, contracts, planerCapital, planerWithdrawal, planerReturn, planerDynamic, includePlanerInNet,
    inflationRate, taxIndexRate, solutionSavingsReturn, solutionSavingsDynamic
  ]);

  // SVG Helper
  const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  const formatResultCurrency = (val) => formatCurrency(showRealValue ? val / calculations.inflationFactor : val);
  const formatChartCurrency = (val, discount) => formatCurrency(showRealValue ? val / discount : val);
  const formatYAxis = (val) => val >= 1000000 ? (val / 1000000).toFixed(1).replace('.0', '') + ' Mio.' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toString();
  const renderBonVal = (val) => (<><span className="print:hidden">{formatResultCurrency(val)}</span><span className="hidden print:inline">{formatCurrency(val)} <span className="text-slate-500 font-normal">({formatCurrency(val / calculations.inflationFactor)} real)</span></span></>);

  const svgWidth = 800, svgHeight = 300, paddingX = 40, paddingY = 20, bottomPadding = 30, graphHeight = svgHeight - paddingY - bottomPadding;
  const maxDataVal = Math.max(...calculations.chartData.map(d => Math.max(showRealValue ? d.etf / d.discount : d.etf, showRealValue ? d.planer / d.discount : d.planer)));
  const maxY = Math.max(100, maxDataVal * 1.1); 
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(mult => maxY * mult); 
  const getX = (index) => paddingX + (index / (Math.max(1, calculations.chartData.length - 1))) * (svgWidth - paddingX * 2);
  const getY = (val) => svgHeight - bottomPadding - (val / maxY) * graphHeight;
  const etfPath = calculations.chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(showRealValue ? d.etf / d.discount : d.etf)}`).join(" ");
  const planerPath = calculations.chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(showRealValue ? d.planer / d.discount : d.planer)}`).join(" ");

  const renderContractInput = (c) => (
    <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm relative group mb-3">
      <button onClick={() => removeContract(c.id)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500"><Trash className="w-4 h-4" /></button>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 pr-6">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Vertragsart</label>
          <select value={c.type} onChange={e => handleContractTypeChange(c.id, e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50">
            {c.layer === 1 && <option value="basis">Rürup / Basisrente</option>}
            {c.layer === 2 && <><option value="bav">bAV (Rente)</option><option value="bavKapital">bAV (Kapital)</option><option value="riester">Riester-Rente</option></>}
            {c.layer === 3 && <><option value="prvRente">Private Rente (monatlich)</option><option value="prvKapital">Private Rente (Kapitalauszahlung)</option><option value="immobilie">Vermietung (Immobilie)</option><option value="etf">Freies Depot (ETF / Aktien)</option></>}
          </select>
        </div>
        <div><label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Bezeichnung</label><input type="text" value={c.name} onChange={e => updateContract(c.id, 'name', e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" placeholder="z.B. Allianz" /></div>
      </div>
      
      {isMarried && (
         <div className="mb-3 flex items-center gap-3 bg-slate-50 p-2 rounded w-max border border-slate-200">
           <span className="text-[10px] font-bold text-slate-500 uppercase">Inhaber:</span>
           <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer"><input type="radio" checked={c.owner !== 'B'} onChange={() => updateContract(c.id, 'owner', 'A')} /> Person A</label>
           <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer"><input type="radio" checked={c.owner === 'B'} onChange={() => updateContract(c.id, 'owner', 'B')} /> Person B</label>
         </div>
      )}

      {c.type !== 'immobilie' && c.type !== 'etf' && (
        <div><label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{c.type.includes('Kapital') ? 'Kapitalauszahlung (€ Brutto)' : 'Rente (€/Monat Brutto)'}</label><input type="number" value={c.gross || ''} onChange={e => updateContract(c.id, 'gross', Number(e.target.value))} className="w-full border border-slate-300 rounded p-2 text-sm font-semibold" /></div>
      )}

      {c.type === 'immobilie' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Kaltmiete (€/M)</label><input type="number" value={c.gross || ''} onChange={e => updateContract(c.id, 'gross', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold" /></div>
          <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Instandhaltung (%)</label><input type="number" step="1" value={c.costs !== undefined ? c.costs : 20} onChange={e => updateContract(c.id, 'costs', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
          <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Dyn. p.a. (%)</label><input type="number" step="0.1" value={c.dynamic !== undefined ? c.dynamic : 1.5} onChange={e => updateContract(c.id, 'dynamic', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
        </div>
      )}

      {c.type === 'etf' && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Kapital heute (€)</label><input type="number" value={c.capital || ''} onChange={e => updateContract(c.id, 'capital', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Sparrate (€/M)</label><input type="number" value={c.monthly || ''} onChange={e => updateContract(c.id, 'monthly', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold" /></div>
          </div>
          <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
             <label className="block text-[10px] font-bold text-blue-800 mb-2 flex items-center gap-1"><Zap className="w-3 h-3"/> Geplante Sonderzahlung / Einmalanlage</label>
             <div className="grid grid-cols-2 gap-3">
               <div><label className="block text-[9px] text-slate-500 mb-1">Summe (€)</label><input type="number" value={c.specialPayment || ''} onChange={e => updateContract(c.id, 'specialPayment', Number(e.target.value))} className="w-full border border-blue-200 bg-white rounded p-1.5 text-xs" placeholder="z.B. Erbe"/></div>
               <div><label className="block text-[9px] text-slate-500 mb-1">Im Jahr</label><input type="number" value={c.specialPaymentYear || ''} onChange={e => updateContract(c.id, 'specialPaymentYear', Number(e.target.value))} className="w-full border border-blue-200 bg-white rounded p-1.5 text-xs" /></div>
             </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Rend. Ansp.</label><input type="number" step="0.1" value={c.returnAcc !== undefined ? c.returnAcc : 6} onChange={e => updateContract(c.id, 'returnAcc', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Rend. Entn.</label><input type="number" step="0.1" value={c.returnWith !== undefined ? c.returnWith : 3} onChange={e => updateContract(c.id, 'returnWith', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">TER (%)</label><input type="number" step="0.1" value={c.ter !== undefined ? c.ter : 0.2} onChange={e => updateContract(c.id, 'ter', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Entnahme %</label><input type="number" step="0.1" value={c.withdrawalRate !== undefined ? c.withdrawalRate : 4} onChange={e => updateContract(c.id, 'withdrawalRate', Number(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
          </div>
          <div className="flex items-center gap-2 pt-1"><input type="checkbox" checked={c.includeInNet !== false} onChange={e => updateContract(c.id, 'includeInNet', e.target.checked)} className="rounded text-emerald-600 w-3 h-3" /><label className="text-[10px] text-slate-600 font-medium">Entnahme ins Gesamt-Netto einrechnen</label></div>
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
          <div className="flex items-center gap-2"><input type="checkbox" checked={c.includeInNet !== false} onChange={e => updateContract(c.id, 'includeInNet', e.target.checked)} className="rounded text-emerald-600 w-3 h-3" /><label className="text-[10px] text-slate-600 font-medium">In mtl. Rente umwandeln & ins Gesamt-Netto</label></div>
        </div>
      )}
      {c.type === 'immobilie' && <div className="flex items-center gap-2 pt-3 border-t"><input type="checkbox" checked={c.includeInNet !== false} onChange={e => updateContract(c.id, 'includeInNet', e.target.checked)} className="rounded text-emerald-600 w-3 h-3" /><label className="text-[10px] text-slate-600 font-medium">In Gesamt-Netto übernehmen</label></div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-28 print:bg-white print:pb-0">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white p-4 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-emerald-400" />
            <div><h1 className="text-xl font-bold">Vorsorge-Analyzer Pro</h1><p className="text-slate-400 text-xs">Präzisions-Engine inkl. Indexierung, Splitting & Teilfreistellung</p></div>
          </div>
          <div className="flex bg-slate-800 p-1.5 rounded-lg border border-slate-700 gap-1.5 flex-wrap justify-center">
            <button onClick={() => setShowRealValue(!showRealValue)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${showRealValue ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Coins className="w-3 h-3" /> Kaufkraft heute</button>
            <div className="w-px bg-slate-700 mx-1"></div>
            
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white shadow">
              <span>Infl.:</span><select value={inflationRate} onChange={e => setInflationRate(Number(e.target.value))} className="bg-transparent font-bold outline-none cursor-pointer"><option value={0}>0 %</option><option value={1.5}>1,5 %</option><option value={2.0}>2,0 %</option><option value={2.5}>2,5 %</option></select>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white shadow">
              <span>Index.:</span><select value={taxIndexRate} onChange={e => setTaxIndexRate(Number(e.target.value))} className="bg-transparent font-bold outline-none cursor-pointer"><option value={0}>0 %</option><option value={1.5}>1,5 %</option><option value={2.0}>2,0 %</option></select>
            </div>
            <div className="w-px bg-slate-700 mx-1"></div>

            <button onClick={() => setIsMarried(false)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!isMarried ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}><User className="w-3 h-3" /> Single</button>
            <button onClick={() => setIsMarried(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isMarried ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}><Users className="w-3 h-3" /> Verheiratet</button>
            
            <div className="w-px bg-slate-700 mx-1"></div>
            
            {/* SESSION MANAGEMENT BUTTONS */}
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
            <button onClick={() => fileInputRef.current.click()} title="Profil laden" className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-white"><FolderOpen className="w-4 h-4" /></button>
            <button onClick={handleExport} title="Profil speichern" className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-white"><Save className="w-4 h-4" /></button>
            
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 ml-1"><Download className="w-3 h-3" /> PDF</button>
          </div>
        </div>
      </header>

      {/* PRINT HEADER */}
      <div className="hidden print:block max-w-6xl mx-auto p-6 text-center border-b-2 border-slate-200 mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-widest">Persönliches Vorsorge-Gutachten</h2>
        <p className="text-slate-500 mt-2">Berechnet unter Berücksichtigung von Inflation ({inflationRate}%), Tarif-Indexierung & Splitting</p>
      </div>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 print:p-0 print:block">
        
        {/* LEFT COLUMN: INPUTS */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-6 print:hidden">
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold mb-4 text-slate-700 border-b border-slate-100 pb-2">Allgemeine Daten & Ziel</h2>
            
            {isMarried && (
              <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                 <button onClick={()=>setPersonTab('A')} className={`flex-1 py-1.5 text-xs font-bold rounded ${personTab==='A' ? 'bg-white shadow text-indigo-700':'text-slate-500'}`}>Person A</button>
                 <button onClick={()=>setPersonTab('B')} className={`flex-1 py-1.5 text-xs font-bold rounded ${personTab==='B' ? 'bg-white shadow text-indigo-700':'text-slate-500'}`}>Person B</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Geburtsdatum ({personTab})</label>
                <input type="text" placeholder="TT.MM.JJJJ" value={personTab === 'A' ? birthDateA : birthDateB} onChange={e => handleBirthDateChange(e.target.value, personTab)} className="w-full border rounded p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Rentenbeginn ({personTab})</label>
                <input type="text" placeholder="TT.MM.JJJJ" value={personTab === 'A' ? retDateA : retDateB} onChange={e => handleRetDateChange(e.target.value, personTab)} className="w-full border rounded p-2 text-sm" />
              </div>
            </div>
            
            <div className="text-[10px] text-slate-500 mb-4 bg-slate-50 border border-slate-100 p-2 rounded flex justify-between">
              <span>Alter heute: <strong className="text-slate-700">{(personTab === 'A' ? calculations.currentAgeA : calculations.currentAgeB).toFixed(1)} J.</strong></span>
              <span>Eintrittsalter: <strong className="text-slate-700">{(personTab === 'A' ? calculations.retirementAgeA : calculations.retirementAgeB).toFixed(1)} J.</strong></span>
            </div>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold text-indigo-600 mb-1">Haushalts-Zielnetto im Alter (Kaufkraft heute in €)</label>
              <input type="number" value={targetIncomeToday} onChange={e => setTargetIncomeToday(Number(e.target.value))} className="w-full border border-indigo-200 bg-indigo-50/50 rounded p-2 font-bold text-indigo-900" />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Krankenversicherung im Alter (Haushalt)</label>
              <select value={kvStatus} onChange={e => setKvStatus(e.target.value)} className="w-full border rounded p-2 text-sm mb-2"><option value="kvdr">Gesetzlich (KVdR - Pflicht)</option><option value="freiwillig">Gesetzlich (Freiwillig)</option><option value="pkv">Privat versichert (PKV)</option></select>
              {kvStatus === 'pkv' && <input type="number" value={pkvPremium} onChange={e => setPkvPremium(Number(e.target.value))} className="w-full border rounded p-2 text-sm" placeholder="Mtl. PKV-Beitrag" />}
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={hasChildren} onChange={e => setHasChildren(e.target.checked)} className="rounded" /> Kinder vorhanden (PV-Zuschlag entfällt)</label>
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={hasChurchTax} onChange={e => setHasChurchTax(e.target.checked)} className="rounded" /> Kirchensteuer (8 %)</label>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200 bg-slate-50">
              {['s1', 's2', 's3', 'planer'].map(t => (
                <button key={t} className={`flex-1 py-3 text-[10px] sm:text-xs font-bold uppercase ${activeTab === t ? 'bg-white text-indigo-700 border-b-2 border-indigo-700' : 'text-slate-500'}`} onClick={() => setActiveTab(t)}>{t === 's1' ? 'Schicht 1' : t === 's2' ? 'Schicht 2' : t === 's3' ? 'Schicht 3' : 'Planer'}</button>
              ))}
            </div>
            <div className="p-4 bg-slate-50/50 min-h-[400px]">
              {activeTab === 's1' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm relative">
                    <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Gesetzliche Rente ({personTab})</span>
                      <button onClick={() => estimatorPerson === personTab ? setEstimatorPerson(null) : openEstimator(personTab)} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1 transition-colors">
                        <Calculator className="w-3 h-3"/> {estimatorPerson === personTab ? 'Schließen' : 'Schätzen'}
                      </button>
                    </h3>

                    {estimatorPerson === personTab && (
                        <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-inner">
                            <h4 className="text-[10px] font-bold text-blue-800 uppercase mb-2">Schnell-Schätzer (Karriere-Kurve)</h4>
                            <div className="mb-3">
                                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Heutiges Bruttojahresgehalt (€)</label>
                                <input type="number" value={estimatorSalary} onChange={e => setEstimatorSalary(Number(e.target.value))} className="w-full border border-blue-200 rounded p-2 text-sm bg-white font-mono font-bold" />
                            </div>
                            <button onClick={() => {
                                if (personTab === 'A') setGrvGrossA(estimatedPension);
                                else setGrvGrossB(estimatedPension);
                                setEstimatorPerson(null);
                            }} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                                <CheckCircle className="w-3.5 h-3.5" /> ca. {estimatedPension} € übernehmen
                            </button>
                            <p className="text-[9px] text-blue-600/70 mt-2 text-center leading-tight">
                                <strong>Logik:</strong> Simuliert exakt {Math.max(0, Math.floor(personTab === 'A' ? calculations.retirementAgeA : calculations.retirementAgeB) - 22)} Arbeitsjahre. Geht davon aus, dass das Gehalt seit dem Alter von 22 Jahren bis heute ({Math.floor(personTab === 'A' ? calculations.currentAgeA : calculations.currentAgeB)} J.) kontinuierlich bis auf den eingegebenen Wert gestiegen ist. (Werte 2026).
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Anspruch (€/M)</label><input type="number" value={personTab==='A'?grvGrossA:grvGrossB} onChange={e => personTab==='A'?setGrvGrossA(Number(e.target.value)):setGrvGrossB(Number(e.target.value))} className="w-full border rounded p-2" /></div>
                      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Dynamik (%)</label><input type="number" step="0.1" value={grvIncreaseRate} onChange={e => setGrvIncreaseRate(Number(e.target.value))} className="w-full border rounded p-2" /></div>
                    </div>
                    {((personTab==='A' ? calculations.grvDiscountA : calculations.grvDiscountB) > 0) && (
                       <div className="mt-3 text-[10px] text-rose-600 bg-rose-50 p-2 rounded flex gap-1.5 border border-rose-100">
                         <AlertCircle className="w-3 h-3 shrink-0" />
                         <span>Vorruhestand: Es werden automatisch {((personTab==='A' ? calculations.grvDiscountA : calculations.grvDiscountB)*100).toFixed(1)}% Abschlag auf diese Rente berechnet.</span>
                       </div>
                    )}
                  </div>
                  {contracts.filter(c => c.layer === 1).map(renderContractInput)}
                  <button onClick={() => addContract(1)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 hover:border-blue-400 hover:text-blue-600"><PlusCircle className="w-4 h-4" /> Rürup hinzufügen</button>
                </div>
              )}
              {activeTab === 's2' && (
                <div className="space-y-4">
                  {contracts.filter(c => c.layer === 2).map(renderContractInput)}
                  <button onClick={() => addContract(2)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 hover:border-purple-400 hover:text-purple-600"><PlusCircle className="w-4 h-4" /> bAV / Riester hinzufügen</button>
                </div>
              )}
              {activeTab === 's3' && (
                <div className="space-y-4">
                  {contracts.filter(c => c.layer === 3).map(renderContractInput)}
                  <button onClick={() => addContract(3)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 hover:border-emerald-400 hover:text-emerald-600"><PlusCircle className="w-4 h-4" /> Vertrag / Depot hinzufügen</button>
                </div>
              )}
              {activeTab === 'planer' && (
                 <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm space-y-4">
                      <div><div className="flex justify-between"><label className="text-xs font-semibold text-slate-600">Start-Kapital (€)</label></div><input type="number" value={planerCapital} onChange={e => setPlanerCapital(Number(e.target.value))} className="w-full border rounded p-2" /></div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className="text-[10px] font-semibold text-slate-600">Entn. mtl.</label><input type="number" value={planerWithdrawal} onChange={e => setPlanerWithdrawal(Number(e.target.value))} className="w-full border rounded p-2 text-sm" /></div>
                        <div><label className="text-[10px] font-semibold text-slate-600">Rendite %</label><input type="number" step="0.1" value={planerReturn} onChange={e => setPlanerReturn(Number(e.target.value))} className="w-full border rounded p-2 text-sm" /></div>
                        <div><label className="text-[10px] font-semibold text-slate-600">Dyn. %</label><input type="number" step="0.1" value={planerDynamic} onChange={e => setPlanerDynamic(Number(e.target.value))} className="w-full border rounded p-2 text-sm" /></div>
                      </div>
                      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={includePlanerInNet} onChange={e=>setIncludePlanerInNet(e.target.checked)} className="rounded" /> In Gesamt-Netto übernehmen</label>
                    </div>
                 </div>
              )}
            </div>
            <div className="p-4 bg-white border-t"><button onClick={loadDemoData} className="w-full border border-dashed rounded p-2 text-sm bg-blue-50 text-blue-700">Demo-Daten laden</button></div>
          </div>
        </div>

        {/* RIGHT COLUMN: RESULTS */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:mt-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 mb-1">Haushalts-Bedarf im Jahr {calculations.baseRetYear}</h3>
              <div className="text-3xl font-bold">{renderBonVal(calculations.targetIncomeFuture)}</div>
            </div>
            <div className={`bg-white rounded-xl shadow-sm border p-6 ${calculations.gap > 0 ? 'border-rose-200 text-rose-600' : 'border-emerald-200 text-emerald-600'}`}>
              <h3 className="text-sm font-semibold mb-1">Rentenlücke</h3>
              <div className="text-3xl font-bold">{calculations.gap > 0 ? renderBonVal(calculations.gap) : 'Gedeckt'}</div>
            </div>
          </div>

          <div className="flex bg-slate-200/50 p-1 rounded border print:hidden">
            <button onClick={() => setRightView('zusammensetzung')} className={`flex-1 py-2 rounded text-xs font-bold flex justify-center gap-2 ${rightView === 'zusammensetzung' ? 'bg-white shadow' : 'text-slate-500'}`}><List className="w-4 h-4" /> Kassenbon</button>
            <button onClick={() => setRightView('verlauf')} className={`flex-1 py-2 rounded text-xs font-bold flex justify-center gap-2 ${rightView === 'verlauf' ? 'bg-white shadow' : 'text-slate-500'}`}><LineChartIcon className="w-4 h-4" /> Verlauf</button>
          </div>

          {/* KASSENBON */}
          <div className={`bg-white rounded-xl shadow-sm border p-6 print:block print:break-inside-avoid ${rightView === 'zusammensetzung' ? 'block' : 'hidden'}`}>
            <h2 className="text-sm font-bold mb-4 print:hidden">Ihr Haushalts-Netto im Jahr {calculations.baseRetYear}</h2>
            
            <div className="space-y-3">
              <div className="border border-blue-100 rounded-lg print:border-slate-300">
                <div className="flex justify-between p-3 bg-blue-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s1')}>
                  <div className="font-bold text-sm text-blue-900">Schicht 1 (Basis)</div>
                  <div className="font-bold">{renderBonVal(calculations.s1_net)}</div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-blue-100 space-y-2 ${expandedSections.s1 ? 'block' : 'hidden'} print:block`}>
                  <div className="flex justify-between bg-slate-50 p-2 rounded">
                    <div><span className="font-semibold block">Gesetzliche Rente (Haushalt)</span><span className="text-[10px] text-slate-500">Brutto: {formatResultCurrency(calculations.grvFutureGrossTotal)}</span></div>
                    <div className="text-right"><span className="font-bold block">{renderBonVal(calculations.grvNet)}</span><span className="text-[10px] text-rose-500">KV/PV: {formatResultCurrency(calculations.grvKvpv)} | ESt: {formatResultCurrency(calculations.grvESt + calculations.grvKist)}</span></div>
                  </div>
                  {calculations.contracts.filter(c=>c.layer===1).map(c=>(
                    <div key={c.id} className="flex justify-between bg-slate-50 p-2 rounded">
                      <div><span className="font-semibold block">{c.name} ({c.owner})</span></div>
                      <div className="text-right"><span className="font-bold block">{renderBonVal(c.net)}</span><span className="text-[10px] text-rose-500">ESt: {formatResultCurrency(c.tax+(c.kist||0))}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-purple-100 rounded-lg print:border-slate-300">
                <div className="flex justify-between p-3 bg-purple-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s2')}>
                  <div className="font-bold text-sm text-purple-900">Schicht 2 (Zusatz)</div>
                  <div className="font-bold">{renderBonVal(calculations.s2_net)}</div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-purple-100 space-y-2 ${expandedSections.s2 ? 'block' : 'hidden'} print:block`}>
                   {calculations.contracts.filter(c=>c.layer===2).map(c=>(
                    <div key={c.id} className="flex justify-between bg-slate-50 p-2 rounded">
                      <div><span className="font-semibold block">{c.name} ({c.owner})</span><span className="text-[10px] text-slate-500">Brutto: {formatResultCurrency(c.gross)}</span></div>
                      <div className="text-right"><span className={`font-bold block ${c.includeInNet===false?'text-slate-400':''}`}>{c.includeInNet===false?0:renderBonVal(c.net)}</span><span className="text-[10px] text-rose-500">{c.kvpv_deduction>0?`KV/PV: ${formatResultCurrency(c.kvpv_deduction)} | `:''}ESt: {formatResultCurrency(c.tax+(c.kist||0))}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-emerald-100 rounded-lg print:border-slate-300">
                <div className="flex justify-between p-3 bg-emerald-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s3')}>
                  <div className="font-bold text-sm text-emerald-900">Schicht 3 (Privat)</div>
                  <div className="font-bold">{renderBonVal(calculations.s3_net)}</div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-emerald-100 space-y-2 ${expandedSections.s3 ? 'block' : 'hidden'} print:block`}>
                  {calculations.contracts.filter(c=>c.layer===3).map(c=>(
                    <div key={c.id} className="flex justify-between bg-slate-50 p-2 rounded">
                      <div>
                        <span className="font-semibold block">{c.name} {c.owner?`(${c.owner})`:''}</span>
                        <span className="text-[10px] text-slate-500">{c.type === 'etf' ? `Auszahlung inkl. 30% Teilfreistellung` : `Brutto: ${formatResultCurrency(c.type==='etf'?c.grossMonthly:c.gross)}`}</span>
                      </div>
                      <div className="text-right"><span className={`font-bold block ${c.includeInNet===false?'text-slate-400':''}`}>{c.includeInNet===false?0:renderBonVal(c.net)}</span><span className="text-[10px] text-rose-500">{c.kvpv_deduction>0?`KV/PV: ${formatResultCurrency(c.kvpv_deduction)} | `:''}{c.type==='etf'?'Abgeltung':'ESt'}: {formatResultCurrency(c.tax+(c.kist||0))}</span></div>
                    </div>
                  ))}
                  {includePlanerInNet && (
                    <div className="flex justify-between bg-indigo-50 p-2 rounded border-l-2 border-indigo-400 mt-2">
                      <div><span className="font-semibold text-indigo-900">Planer Wunsch-Rente</span></div>
                      <div className="text-right"><span className="font-bold text-indigo-900">{renderBonVal(planerWithdrawal)}</span></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between p-4 mt-4 rounded bg-slate-900 text-white print:bg-slate-100 print:text-slate-800 print:border">
                <div className="font-bold text-lg">Erwartetes Gesamt-Netto</div>
                <div className="font-bold text-xl">{renderBonVal(calculations.totalNetFuture)}</div>
              </div>
            </div>
          </div>

          {/* CHART */}
          <div className={`bg-white rounded-xl border p-6 h-[400px] print:block print:h-[350px] print:mt-8 print:break-inside-avoid ${rightView === 'verlauf' ? 'block' : 'hidden'}`}>
            <h2 className="text-sm font-bold mb-6">Kapitalverlauf (Depot-Entnahme)</h2>
            <div className="w-full h-[280px] relative" onMouseLeave={() => setHoveredData(null)}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible print:text-slate-800">
                {yTicks.map((val, i) => (
                  <g key={`y-${i}`}>
                    <line x1={paddingX} y1={getY(val)} x2={svgWidth - paddingX} y2={getY(val)} stroke="#e2e8f0" strokeWidth="1" />
                    <text x={paddingX - 10} y={getY(val) + 4} fontSize="11" fill="currentColor" opacity="0.5" textAnchor="end">{formatYAxis(val)}</text>
                  </g>
                ))}
                {calculations.chartData.filter((d, i) => d.age % 5 === 0 || i === 0 || i === calculations.chartData.length - 1).map((d) => {
                  const origIndex = calculations.chartData.indexOf(d);
                  return (
                    <g key={`x-${d.age}`}>
                      <text x={getX(origIndex)} y={svgHeight - 15} fontSize="11" fill="currentColor" opacity="0.5" textAnchor="middle">{d.age} J.</text>
                      <line x1={getX(origIndex)} y1={svgHeight - bottomPadding} x2={getX(origIndex)} y2={svgHeight - bottomPadding + 5} stroke="#cbd5e1" />
                    </g>
                  );
                })}
                <line x1={paddingX} y1={svgHeight - bottomPadding} x2={svgWidth - paddingX} y2={svgHeight - bottomPadding} stroke="#94a3b8" strokeWidth="2" />
                {calculations.etfTotalCapital > 0 && <path d={etfPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                {planerCapital > 0 && <path d={planerPath} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" />}
                {calculations.chartData.map((d, i) => {
                  const rectWidth = (svgWidth - paddingX * 2) / Math.max(1, calculations.chartData.length - 1);
                  return <rect key={`hover-${i}`} x={getX(i) - rectWidth/2} y={0} width={rectWidth} height={svgHeight - bottomPadding} fill="transparent" onMouseEnter={() => setHoveredData({ ...d, index: i })} className="cursor-crosshair print:hidden" />;
                })}
                {hoveredData && <line x1={getX(hoveredData.index)} y1={paddingY} x2={getX(hoveredData.index)} y2={svgHeight - bottomPadding} stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" className="print:hidden" />}
              </svg>
            </div>
          </div>

          {/* LÖSUNGS-RECHNER & OPTIMIZER */}
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 text-white print:bg-white print:text-slate-800 print:border-slate-300 print:break-inside-avoid">
              <h3 className="text-sm font-bold text-indigo-400 mb-4 flex items-center gap-2 print:text-indigo-700">
                  <Activity className="w-5 h-5" /> Smart Optimizer: Rentenlücke schließen
              </h3>
              {calculations.gap <= 0 ? (
                  <div className="text-emerald-400 font-medium">Glückwunsch! Ihr Haushaltsbedarf ist vollständig gedeckt.</div>
              ) : (
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 print:bg-slate-50 print:border-slate-200">
                            <div className="text-xs text-slate-400">Benötigtes Ziel-Kapital</div>
                            <div className="text-2xl font-bold text-emerald-400">{formatResultCurrency(calculations.requiredCapital)}</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 print:bg-slate-50 print:border-slate-200">
                            <div className="text-xs text-slate-400">Mtl. Start-Sparrate (heute)</div>
                            <div className="text-2xl font-bold text-white print:text-slate-800">{formatCurrency(calculations.requiredSavings)}</div>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4 border-t border-slate-800 print:border-slate-200 mt-2">
                           <div>
                               <label className="block text-[9px] text-slate-400 uppercase mb-1">Annahme Rendite</label>
                               <select value={solutionSavingsReturn} onChange={e => setSolutionSavingsReturn(Number(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded print:bg-white print:text-black print:border"><option value={4}>4.0 %</option><option value={5}>5.0 %</option><option value={6}>6.0 %</option><option value={7}>7.0 %</option></select>
                           </div>
                           <div>
                               <label className="block text-[9px] text-slate-400 uppercase mb-1">Dynamik Sparrate</label>
                               <select value={solutionSavingsDynamic} onChange={e => setSolutionSavingsDynamic(Number(e.target.value))} className="bg-slate-800 text-xs text-white p-1 rounded print:bg-white print:text-black print:border"><option value={0}>0.0 %</option><option value={1.5}>1.5 %</option><option value={3}>3.0 %</option><option value={5}>5.0 %</option></select>
                           </div>
                      </div>
                  </div>
              )}
          </div>

        </div>
      </main>

      {/* DASHBOARD FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-xl print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex flex-col"><span className="text-[10px] text-slate-400 uppercase font-bold">Zielbedarf</span><span className="text-sm sm:text-lg font-bold text-white">{formatResultCurrency(calculations.targetIncomeFuture)}</span></div>
          <div className="w-px h-8 bg-slate-700 mx-2"></div>
          <div className="flex flex-col items-center"><span className="text-[10px] text-emerald-400 uppercase font-bold flex gap-1"><Activity className="w-3 h-3" /> Haushalts-Netto</span><span className="text-xl sm:text-3xl font-black text-emerald-400">{formatResultCurrency(calculations.totalNetFuture)}</span></div>
          <div className="w-px h-8 bg-slate-700 mx-2"></div>
          <div className="flex flex-col text-right"><span className="text-[10px] text-slate-400 uppercase font-bold">Lücke</span><span className={`text-sm sm:text-lg font-bold ${calculations.gap > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{calculations.gap > 0 ? formatResultCurrency(calculations.gap) : 'Gedeckt!'}</span></div>
        </div>
      </div>
    </div>
  );
}