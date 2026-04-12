import React, { useState, useMemo, useRef } from 'react';
import { 
  Upload, FileText, TrendingUp, AlertCircle, Calculator, 
  CheckCircle, ChevronDown, ChevronUp, ShieldAlert, PiggyBank, 
  Briefcase, PlusCircle, Trash, Users, User, Info, Coins, Clock, Infinity as InfinityIcon, Wallet, Activity,
  LineChart as LineChartIcon, List, Download, Home, Save, FolderOpen, Zap
} from 'lucide-react';

// Helper für Input-Zahlen: Lässt leere Strings zu, damit man Nullen (besonders am Handy) problemlos löschen kann
const parseNum = (val) => val === '' ? '' : Number(val);

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
  const [targetIncomeToday, setTargetIncomeToday] = useState(2000); 
  const [hasChurchTax, setHasChurchTax] = useState(false);
  const [hasChildren, setHasChildren] = useState(true);
  const [kvStatus, setKvStatus] = useState('kvdr'); 
  const [pkvPremium, setPkvPremium] = useState(600);

  // Benchmark States für das Gehalt
  const [currentNetIncome, setCurrentNetIncome] = useState(2500);
  const [wageGrowthRate, setWageGrowthRate] = useState(2.0);

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
  const [taxIndexRate, setTaxIndexRate] = useState(1.5);
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
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [printExplanationMode, setPrintExplanationMode] = useState('short'); 
  const [manualChartStart, setManualChartStart] = useState(null); 

  // --- RENTEN-SCHÄTZER STATES & LOGIK ---
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

  const [planerCapital, setPlanerCapital] = useState(0);
  const [planerDuration, setPlanerDuration] = useState(25);
  const [planerReturn, setPlanerReturn] = useState(3.0);
  const [planerDynamic, setPlanerDynamic] = useState(2.0);
  const [includePlanerInNet, setIncludePlanerInNet] = useState(false);

  const fileInputRef = useRef(null);

  const toggleSection = (sec) => setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));

  const handleBirthDateChange = (val, person) => {
     const formatted = formatDateInput(val);
     if (person === 'A') {
         setBirthDateA(formatted);
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
      currentNetIncome, wageGrowthRate,
      birthDateA, retDateA, grvGrossA, 
      birthDateB, retDateB, grvGrossB, 
      grvIncreaseRate, inflationRate, taxIndexRate, 
      solutionSavingsReturn, solutionSavingsDynamic, contracts, planerCapital, planerDuration, planerReturn, planerDynamic, includePlanerInNet 
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
        if (data.currentNetIncome) setCurrentNetIncome(data.currentNetIncome);
        if (data.wageGrowthRate !== undefined) setWageGrowthRate(data.wageGrowthRate);
        if (data.contracts) setContracts(data.contracts);
        if (data.grvGrossA !== undefined) setGrvGrossA(data.grvGrossA);
        if (data.grvGrossB !== undefined) setGrvGrossB(data.grvGrossB);
        if (data.inflationRate) setInflationRate(data.inflationRate);
        if (data.planerDuration !== undefined) setPlanerDuration(data.planerDuration);
        if (data.planerWithdrawal !== undefined && !data.planerDuration) setPlanerDuration(25);
        
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
      { id: 8, layer: 3, type: 'etf', name: 'Gemeinsames ETF-Depot', capital: 45000, monthly: 350, returnAcc: 6.0, returnWith: 3.5, ter: 0.2, duration: 25, payoutStrategy: 'planer', owner: 'A' }
    ]);
  };

  const addContract = (layer) => {
    const newId = Date.now();
    let defaultType = layer === 1 ? 'basis' : layer === 2 ? 'bav' : 'prvRente';
    let newContract = { id: newId, layer, type: defaultType, name: 'Neuer Vertrag', gross: 0, owner: personTab };
    if (defaultType === 'prvKapital') newContract = { ...newContract, startYear: new Date().getFullYear() - 5, monthlyPremium: 100, dynamic: 3, payoutStrategy: 'planer' };
    if (defaultType === 'bavKapital') newContract = { ...newContract, payoutStrategy: 'planer' };
    setContracts([...contracts, newContract]);
  };

  const updateContract = (id, field, value) => setContracts(contracts.map(c => c.id === id ? { ...c, [field]: value } : c));
  const removeContract = (id) => setContracts(contracts.filter(c => c.id !== id));

  const handleContractTypeChange = (id, newType) => {
    setContracts(contracts.map(c => {
        if (c.id === id) {
            let updates = { type: newType, gross: c.gross || 0, payoutStrategy: 'rent' };
            if (newType === 'immobilie') { updates.costs = 20; updates.dynamic = 1.5; }
            if (newType === 'etf') { updates.capital = 0; updates.monthly = 100; updates.returnAcc = 6.0; updates.returnWith = 3.0; updates.ter = 0.2; updates.duration = 25; updates.specialPayment = 0; updates.specialPaymentYear = new Date().getFullYear() + 10; updates.payoutStrategy = 'planer'; }
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
    
    // Letztes Netto vor der Rente prognostizieren
    const projectedFinalNet = currentNetIncome * Math.pow(1 + wageGrowthRate / 100, maxYearsToRet);
    
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

    // 1. DURCHLAUF: ZvE und KV/PV Basis berechnen (OHNE Steuern & Auszahlungsstrategie-Verteilung)
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
        if (kvStatus === 'freiwillig') incomeForKV = Number(c.gross);
      } 
      else if (c.type === 'bav') {
        zvE_contribution = Number(c.gross); 
        if (kvStatus === 'kvdr') {
          const bav_kv = Math.max(0, c.gross - bavFreibetragKV) * kvRateFull;
          const bav_pv = c.gross > bavFreibetragKV ? c.gross * pvRateFull : 0;
          kvpv_deduction = bav_kv + bav_pv;
          deductible_kvpv += kvpv_deduction;
        } else if (kvStatus === 'freiwillig') incomeForKV = Number(c.gross); 
      }
      else if (c.type === 'riester') {
        zvE_contribution = Number(c.gross); 
        if (kvStatus === 'freiwillig') incomeForKV = 0; 
      }
      else if (c.type === 'prvRente') {
        zvE_contribution = c.gross * cErtRate; 
        if (kvStatus === 'freiwillig') incomeForKV = Number(c.gross); 
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
        
        let cap = (c.capital || 0) * Math.pow(1 + (netReturnAcc/100), maxYearsToRet);
        if ((c.monthly || 0) > 0) {
            if (r_monthly_acc > 0) {
                cap += (c.monthly || 0) * ((Math.pow(1 + r_monthly_acc, months) - 1) / r_monthly_acc);
            } else {
                cap += (c.monthly || 0) * months;
            }
        }
        
        if (c.specialPayment > 0 && c.specialPaymentYear > currentYear) {
            const yearsInvested = baseRetYear - c.specialPaymentYear;
            if (yearsInvested > 0) cap += c.specialPayment * Math.pow(1 + (netReturnAcc/100), yearsInvested);
            else cap += Number(c.specialPayment); 
        }
        c.totalCap = cap;

        const duration = c.duration !== undefined ? c.duration : 25;
        const netReturnWith = Math.max(0, (c.returnWith || 0) - (c.ter || 0));
        const r_w = netReturnWith / 100;

        let grossMonthly = 0;
        if (duration > 0) {
            if (r_w === 0) {
                grossMonthly = cap / (duration * 12);
            } else {
                const W_yearly = cap * (r_w / (1 - Math.pow(1 + r_w, -duration)));
                grossMonthly = W_yearly / 12;
            }
        }
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
    let transferredCapital = 0; // Sammelbecken für den Planer

    // 2. DURCHLAUF: Steuern & Auszahlungsstrategie-Verteilung anwenden
    const finalizedContracts = processedContracts.map(c => {
      let net = 0, tax = 0, kist = 0;
      const strategy = c.payoutStrategy || (c.includeInNet === false ? 'ignore' : 'rent');

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
        
        if (strategy === 'planer') {
            transferredCapital += c.netCapital;
        } else if (strategy === 'rent') {
            net = (c.netCapital * ((c.withdrawalRate || 4) / 100)) / 12; 
            s2_net += net;
        }
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
        
        if (strategy === 'planer') {
            transferredCapital += c.netCapital;
        } else if (strategy === 'rent') {
            net = (c.netCapital * ((c.withdrawalRate || 4) / 100)) / 12;
            s3_net += net;
        }
      }
      else if (c.type === 'immobilie') {
        tax = c.taxableRent * avgTaxRate;
        kist = tax * kistRate;
        net = c.taxableRent - c.kvpv_deduction - tax - kist;
        if (c.includeInNet !== false) s3_net += net;
      }
      else if (c.type === 'etf') {
        const months = maxYearsToRet * 12;
        const totalInvested = (c.capital || 0) + ((c.monthly || 0) * months) + (c.specialPaymentYear <= baseRetYear ? (c.specialPayment || 0) : 0);
        const duration = c.duration !== undefined ? c.duration : 25;
        
        // Lump-Sum Taxation (für Planer oder Ignoriert)
        const profitLump = Math.max(0, c.totalCap - totalInvested);
        const capTaxableBase = profitLump * 0.7; 
        let capTax = capTaxableBase * 0.25; 
        let capKist = hasChurchTax ? capTaxableBase * 0.08 : 0;
        capTax += capTax * 0.055; 
        c.netCapital = Math.max(0, c.totalCap - capTax - capKist);

        if (strategy === 'planer' || strategy === 'ignore') {
             tax = capTax; 
             kist = capKist;
             if (strategy === 'planer') transferredCapital += c.netCapital;
        } else if (strategy === 'rent') {
             // Präzise Versteuerung bei monatlicher Entnahme über die Laufzeit
             const totalPayout = c.grossMonthly * 12 * duration;
             const totalProfit = Math.max(0, totalPayout - totalInvested);
             const profitRatio = totalPayout > 0 ? (totalProfit / totalPayout) : 0;
             
             const taxableProfitPortion = c.grossMonthly * profitRatio;
             const taxableBase = taxableProfitPortion * 0.7; // 30% Teilfreistellung
             
             tax = taxableBase * 0.25; 
             kist = hasChurchTax ? taxableBase * 0.08 : 0;
             const soli = tax * 0.055;
             tax += soli;
             
             net = c.grossMonthly - c.kvpv_deduction - tax - kist;
             s3_net += net;
        }
      }
      return { ...c, net, tax, kist };
    });

    // --- PLANER LOGIK NEU (Inkl. Abgeltungsteuer auf neue Gewinne) ---
    const effectivePlanerCapital = Number(planerCapital) + transferredCapital;
    let finalPlanerWithdrawalGross = 0;
    let finalPlanerWithdrawalNet = 0;
    let planerTax = 0;
    let planerKist = 0;

    if (effectivePlanerCapital > 0 && planerDuration > 0) {
        const r_p = planerReturn / 100;
        const d_p = planerDynamic / 100;
        if (Math.abs(r_p - d_p) < 0.0001) {
            finalPlanerWithdrawalGross = effectivePlanerCapital / (planerDuration * 12);
        } else {
            const R = 1 + r_p;
            const D = 1 + d_p;
            const W1_yearly = effectivePlanerCapital * ((R - D) / (1 - Math.pow(D/R, planerDuration)));
            finalPlanerWithdrawalGross = W1_yearly / 12;
        }

        // Steuern auf die *neuen* Zinsen im Planer berechnen
        let totalPayout = 0;
        let currentW = finalPlanerWithdrawalGross * 12;
        for(let i=0; i<planerDuration; i++) {
            totalPayout += currentW;
            currentW *= (1 + d_p);
        }

        const totalProfit = Math.max(0, totalPayout - effectivePlanerCapital);
        const profitRatio = totalPayout > 0 ? (totalProfit / totalPayout) : 0;

        const taxablePortion = finalPlanerWithdrawalGross * profitRatio;
        // Keine 30% Teilfreistellung, da generischer Auszahlungsplan
        let tax = taxablePortion * 0.25;
        let kist = hasChurchTax ? taxablePortion * 0.08 : 0;
        tax += tax * 0.055; // Soli

        planerTax = tax;
        planerKist = kist;
        finalPlanerWithdrawalNet = finalPlanerWithdrawalGross - planerTax - planerKist;
    }

    if (includePlanerInNet) s3_net += finalPlanerWithdrawalNet;

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

    // --- INCOME CHART DATA (Bar Chart) ---
    const incomeChartData = [];
    const startYearChart = currentYear; 
    const endYearChart = currentYear + Math.max(50, 105 - Math.floor(currentAgeA)); 
    
    const etfNets = finalizedContracts.filter(c => c.type === 'etf' && (c.payoutStrategy || (c.includeInNet === false ? 'ignore' : 'rent')) === 'rent');

    for (let y = startYearChart; y <= endYearChart; y++) {
      const yearsFromNow = Math.max(0, y - currentYear);
      const ageA_in_y = Math.floor(currentAgeA + yearsFromNow);
      const discount = Math.pow(1 + inflationRate / 100, yearsFromNow);
      const target = targetIncomeToday * Math.pow(1 + inflationRate / 100, yearsFromNow);

      if (y < baseRetYear) {
        const netSalary = currentNetIncome * Math.pow(1 + wageGrowthRate / 100, yearsFromNow);
        incomeChartData.push({
          age: ageA_in_y, year: y, isRetirement: false,
          totalNet: netSalary, target, discount, planer: 0
        });
      } else {
        const yearsInRet = y - baseRetYear;
        const s1_net_chart = grvNet * Math.pow(1 + grvIncreaseRate / 100, yearsInRet) + (s1_net - grvNet);
        const s2_net_chart = s2_net;
        
        let s3_net_chart = s3_net - (includePlanerInNet ? finalPlanerWithdrawalNet : 0);
        etfNets.forEach(c => {
            const dur = c.duration !== undefined ? c.duration : 25;
            if (yearsInRet >= dur) s3_net_chart -= c.net;
        });

        let currentPlanerNet = 0;
        if (includePlanerInNet && yearsInRet < planerDuration) {
          currentPlanerNet = finalPlanerWithdrawalNet * Math.pow(1 + planerDynamic / 100, yearsInRet);
        }

        const totalNet = s1_net_chart + s2_net_chart + s3_net_chart + currentPlanerNet;
        incomeChartData.push({
          age: ageA_in_y, year: y, isRetirement: true,
          totalNet, target, discount, planer: currentPlanerNet
        });
      }
    }

    return {
      currentAgeA, currentAgeB, retirementAgeA, retirementAgeB,
      yearsToRetA, yearsToRetB, maxYearsToRet, targetIncomeFuture, baseRetYear,
      inflationFactor, incomeChartData, zvE_yearly: zvE_yearly_nominal, avgTaxRate, marginalTaxRate: marginalTaxToday, deductible_kvpv, 
      grvFutureGrossTotal, grvNet, grvKvpv, grvESt, grvKist, s1_net, s2_net, s3_net, contracts: finalizedContracts,
      totalNetFuture: s1_net + s2_net + s3_net, gap, requiredCapital, requiredSavings, lumpSumRequired,
      grvDiscountA: getGrvAbschlag(retirementAgeA), grvDiscountB: getGrvAbschlag(retirementAgeB), projectedFinalNet,
      effectivePlanerCapital, finalPlanerWithdrawal: finalPlanerWithdrawalNet, finalPlanerWithdrawalGross, planerTax, planerKist, transferredCapital
    };
  }, [
    birthDateA, retDateA, grvGrossA, birthDateB, retDateB, grvGrossB,
    targetIncomeToday, hasChildren, isMarried, kvStatus, pkvPremium, hasChurchTax, currentNetIncome, wageGrowthRate,
    grvIncreaseRate, contracts, planerCapital, planerDuration, planerReturn, planerDynamic, includePlanerInNet,
    inflationRate, taxIndexRate, solutionSavingsReturn, solutionSavingsDynamic
  ]);

  // SVG Helper
  const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  const formatResultCurrency = (val) => formatCurrency(showRealValue ? val / calculations.inflationFactor : val);
  const formatChartCurrency = (val, discount) => formatCurrency(showRealValue ? val / discount : val);
  const formatYAxis = (val) => val >= 1000000 ? (val / 1000000).toFixed(1).replace('.0', '') + ' Mio.' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toString();
  const renderBonVal = (val) => (<><span className="print:hidden">{formatResultCurrency(val)}</span><span className="hidden print:inline">{formatCurrency(val)} <span className="text-slate-500 font-normal">({formatCurrency(val / calculations.inflationFactor)} real)</span></span></>);

  // --- CHART VIEW LOGIC (Sliding Window) ---
  const chartWindowSize = 30; // 30 Jahre gleichzeitig sichtbar
  const defaultStartAge = Math.max(Math.floor(calculations.currentAgeA), Math.floor(calculations.retirementAgeA) - 3);
  const activeStartAge = manualChartStart !== null ? manualChartStart : defaultStartAge;
  const visibleChartData = calculations.incomeChartData.filter(d => d.age >= activeStartAge && d.age <= activeStartAge + chartWindowSize);

  const svgWidth = 800, svgHeight = 300, paddingX = 55, paddingY = 20, bottomPadding = 30, graphHeight = svgHeight - paddingY - bottomPadding;
  
  const maxDataVal = visibleChartData.length > 0 ? Math.max(...visibleChartData.map(d => {
    const val = showRealValue ? (d.totalNet / (d.discount || 1)) : d.totalNet;
    const tgt = showRealValue ? (d.target / (d.discount || 1)) : d.target;
    return Math.max(isNaN(val) ? 0 : val, isNaN(tgt) ? 0 : tgt);
  })) : 0;
  
  const maxY = Math.max(1000, (isNaN(maxDataVal) ? 1000 : maxDataVal) * 1.15); 
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(mult => maxY * mult); 
  const stepX = (svgWidth - paddingX * 2) / Math.max(1, visibleChartData.length);
  const barWidth = stepX * 0.7;
  const getY = (val) => svgHeight - bottomPadding - (val / maxY) * graphHeight;
  
  const targetPath = visibleChartData.map((d, i) => {
    const cx = paddingX + i * stepX + stepX / 2;
    const tgt = showRealValue ? (d.target / (d.discount || 1)) : d.target;
    return `${i === 0 ? 'M' : 'L'} ${cx} ${getY(isNaN(tgt) ? 0 : tgt)}`;
  }).join(" ");

  const renderContractInput = (c) => (
    <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm relative group mb-3 print:border-slate-300 print:shadow-none">
      <button onClick={() => removeContract(c.id)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 print:hidden"><Trash className="w-4 h-4" /></button>
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
        <div><label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{c.type.includes('Kapital') ? 'Kapitalauszahlung (€ Brutto)' : 'Rente (€/Monat Brutto)'}</label><input type="number" value={c.gross ?? ''} onChange={e => updateContract(c.id, 'gross', parseNum(e.target.value))} className="w-full border border-slate-300 rounded p-2 text-sm font-semibold" /></div>
      )}

      {c.type === 'immobilie' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Kaltmiete (€/M)</label><input type="number" value={c.gross ?? ''} onChange={e => updateContract(c.id, 'gross', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold" /></div>
          <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Instandhaltung (%)</label><input type="number" step="1" value={c.costs ?? 20} onChange={e => updateContract(c.id, 'costs', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
          <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Dyn. p.a. (%)</label><input type="number" step="0.1" value={c.dynamic ?? 1.5} onChange={e => updateContract(c.id, 'dynamic', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
        </div>
      )}

      {c.type === 'etf' && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Kapital heute (€)</label><input type="number" value={c.capital ?? ''} onChange={e => updateContract(c.id, 'capital', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Sparrate (€/M)</label><input type="number" value={c.monthly ?? ''} onChange={e => updateContract(c.id, 'monthly', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs font-semibold" /></div>
          </div>
          <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 print:bg-white print:border-slate-200">
             <label className="block text-[10px] font-bold text-blue-800 mb-2 flex items-center gap-1"><Zap className="w-3 h-3"/> Geplante Sonderzahlung / Einmalanlage</label>
             <div className="grid grid-cols-2 gap-3">
               <div><label className="block text-[9px] text-slate-500 mb-1">Summe (€)</label><input type="number" value={c.specialPayment ?? ''} onChange={e => updateContract(c.id, 'specialPayment', parseNum(e.target.value))} className="w-full border border-blue-200 bg-white rounded p-1.5 text-xs print:border-slate-300" placeholder="z.B. Erbe"/></div>
               <div><label className="block text-[9px] text-slate-500 mb-1">Im Jahr</label><input type="number" value={c.specialPaymentYear ?? ''} onChange={e => updateContract(c.id, 'specialPaymentYear', parseNum(e.target.value))} className="w-full border border-blue-200 bg-white rounded p-1.5 text-xs print:border-slate-300" /></div>
             </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Rend. Ansp.</label><input type="number" step="0.1" value={c.returnAcc ?? 6} onChange={e => updateContract(c.id, 'returnAcc', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Rend. Entn.</label><input type="number" step="0.1" value={c.returnWith ?? 3} onChange={e => updateContract(c.id, 'returnWith', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">TER (%)</label><input type="number" step="0.1" value={c.ter ?? 0.2} onChange={e => updateContract(c.id, 'ter', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            <div><label className="block text-[10px] font-bold text-indigo-600 mb-1">Dauer Entn. (J)</label><input type="number" step="1" value={c.duration ?? 25} onChange={e => updateContract(c.id, 'duration', parseNum(e.target.value))} className="w-full border-2 border-indigo-300 rounded p-1.5 text-xs font-bold" /></div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <label className="block text-[10px] font-semibold text-slate-500 mb-2 uppercase">Auszahlungs-Strategie</label>
            <select
               value={c.payoutStrategy || (c.includeInNet === false ? 'ignore' : 'rent')}
               onChange={e => updateContract(c.id, 'payoutStrategy', e.target.value)}
               className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white font-medium text-slate-700"
            >
               <option value="rent">Mtl. Entnahme (ins Gesamt-Netto)</option>
               <option value="planer">Kapital komplett in den Planer übertragen</option>
               <option value="ignore">Ignorieren (Nur Kapitalwert anzeigen)</option>
            </select>
          </div>
        </div>
      )}

      {(c.type === 'prvKapital' || c.type === 'bavKapital') && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          {c.type === 'prvKapital' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Beginn (J)</label><input type="number" value={c.startYear ?? ''} onChange={e => updateContract(c.id, 'startYear', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Beitrag (€)</label><input type="number" value={c.monthlyPremium ?? ''} onChange={e => updateContract(c.id, 'monthlyPremium', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Dyn. (%)</label><input type="number" step="0.1" value={c.dynamic ?? ''} onChange={e => updateContract(c.id, 'dynamic', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
            </div>
          )}
          <div className="mt-1">
            <label className="block text-[10px] font-semibold text-slate-500 mb-2 uppercase">Auszahlungs-Strategie</label>
            <select
               value={c.payoutStrategy || (c.includeInNet === false ? 'ignore' : 'rent')}
               onChange={e => updateContract(c.id, 'payoutStrategy', e.target.value)}
               className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white font-medium text-slate-700"
            >
               <option value="rent">In mtl. Rente umwandeln (ins Netto)</option>
               <option value="planer">Netto-Kapital in den Planer übertragen</option>
               <option value="ignore">Ignorieren (Nur Netto-Kapital anzeigen)</option>
            </select>
          </div>
        </div>
      )}
      {c.type === 'immobilie' && <div className="flex items-center gap-2 pt-3 border-t"><input type="checkbox" checked={c.includeInNet !== false} onChange={e => updateContract(c.id, 'includeInNet', e.target.checked)} className="rounded text-emerald-600 w-3 h-3" /><label className="text-[10px] text-slate-600 font-medium">In Gesamt-Netto übernehmen</label></div>}
    </div>
  );

  const renderBonContract = (c) => {
    const strategy = c.payoutStrategy || (c.includeInNet === false ? 'ignore' : 'rent');
    const isKapital = c.type === 'etf' || c.type.includes('Kapital');
    const bruttoKapital = c.type === 'etf' ? c.totalCap : c.gross;
    
    const headerColor = c.layer === 1 ? 'text-blue-900' : c.layer === 2 ? 'text-purple-900' : 'text-emerald-900';

    return (
      <div key={c.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2 break-inside-avoid">
        <div className="flex justify-between items-center mb-1">
          <div className={`font-semibold text-sm ${headerColor}`}>{c.name} {isMarried ? `(${c.owner})` : ''}</div>
          <div className={`font-bold text-base ${strategy !== 'rent' ? 'text-slate-400' : 'text-slate-800'}`}>
            {strategy !== 'rent' ? '0 €' : renderBonVal(c.net)}
          </div>
        </div>
        <div className="flex justify-between items-end text-[10px] text-slate-500">
          <div>
            {isKapital
              ? `Brutto-Kapital: ${formatResultCurrency(bruttoKapital)} (Netto: ${formatResultCurrency(c.netCapital || 0)}) | ${strategy === 'planer' ? 'In Planer übertragen' : strategy === 'ignore' ? 'Ignoriert' : 'Mtl. Entnahme'}`
              : `Brutto: ${formatResultCurrency(c.gross)}`}
          </div>
          {(c.kvpv_deduction > 0 || (c.tax || 0) > 0 || (c.kist || 0) > 0) && (
            <div className="text-rose-500 text-right leading-tight">
              {c.kvpv_deduction > 0 ? `KV/PV: ${formatResultCurrency(c.kvpv_deduction)} | ` : ''}
              {c.type === 'etf' ? 'Abgeltung: ' : 'ESt: '}
              {formatResultCurrency((c.tax || 0) + (c.kist || 0))}
            </div>
          )}
        </div>
      </div>
    );
  };

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
            
            <div className="w-px bg-slate-700 mx-1"></div>

            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium bg-slate-800 border border-slate-700 text-white">
              <span className="text-slate-400 hidden sm:inline">PDF-Text:</span>
              <select value={printExplanationMode} onChange={e => setPrintExplanationMode(e.target.value)} className="bg-transparent font-bold outline-none cursor-pointer">
                <option value="none" className="text-slate-800">Ohne</option>
                <option value="short" className="text-slate-800">Kurz</option>
                <option value="long" className="text-slate-800">Ausführlich</option>
              </select>
            </div>
            
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 shadow-sm ml-1"><Download className="w-3 h-3" /> PDF</button>
          </div>
        </div>
      </header>

      {/* PRINT HEADER */}
      <div className="hidden print:block max-w-6xl mx-auto p-6 text-center border-b-2 border-slate-200 mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-widest">Persönliches Vorsorge-Gutachten</h2>
        <p className="text-slate-500 mt-2">Berechnet unter Berücksichtigung von Inflation ({inflationRate}%), Tarif-Indexierung & Splitting</p>
      </div>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 print:p-0 print:block">
        
        {/* PRINT ONLY: ZUSAMMENFASSUNG EINGABEN */}
        <div className="hidden print:block mb-8 break-inside-avoid">
           <h2 className="text-xl font-bold uppercase tracking-widest border-b-2 border-slate-200 pb-2 mb-4 text-slate-800">1. Ihre Eingabedaten & Prämissen</h2>
           
           <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                 <div><span className="font-bold">Alter heute:</span> {Math.floor(calculations.currentAgeA)} Jahre {isMarried ? `(Person A) / ${Math.floor(calculations.currentAgeB)} Jahre (Person B)` : ''}</div>
                 <div><span className="font-bold">Renteneintritt:</span> {Math.floor(calculations.retirementAgeA)} Jahre (im Jahr {calculations.baseRetYear})</div>
                 <div><span className="font-bold">Zielbedarf (Netto):</span> {formatCurrency(targetIncomeToday)} (in Kaufkraft heute)</div>
                 <div><span className="font-bold">Steuer-Status:</span> {isMarried ? 'Splittingtarif (Verheiratet)' : 'Grundtarif (Single)'}</div>
                 <div><span className="font-bold">KV-Status im Alter:</span> {kvStatus === 'kvdr' ? 'KVdR (Pflichtversichert)' : kvStatus === 'pkv' ? 'Privat versichert (PKV)' : 'Freiwillig gesetzlich'}</div>
                 <div><span className="font-bold">Inflation (angenommen):</span> {inflationRate.toLocaleString("de-DE")} % p.a.</div>
                 <div><span className="font-bold">Tarif-Indexierung:</span> {taxIndexRate.toLocaleString("de-DE")} % p.a.</div>
              </div>
           </div>

           <div className="mb-6">
              <h3 className="font-bold text-slate-800 mb-2">Gesetzliche Basis (Schicht 1)</h3>
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                 <li>Brutto-Anspruch heute: <strong>{formatCurrency(grvGrossA)} / Monat</strong> {isMarried && grvGrossB > 0 ? `(Person A) & ${formatCurrency(grvGrossB)} / Monat (Person B)` : ''} <span className="text-slate-500">(Dynamik: {grvIncreaseRate}% p.a.)</span></li>
              </ul>
           </div>

           {contracts.length > 0 && (
             <div>
                <h3 className="font-bold text-slate-800 mb-2">Ihre Zusatz-Verträge & Depots</h3>
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-slate-800">
                      <th className="pb-2 font-bold w-20">Schicht</th>
                      <th className="pb-2 font-bold w-28">Art</th>
                      <th className="pb-2 font-bold">Name / Inhaber</th>
                      <th className="pb-2 font-bold">Wert / Beitrag</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                     {contracts.map(c => (
                        <tr key={c.id} className="border-b border-slate-100">
                           <td className="py-2">Schicht {c.layer}</td>
                           <td className="py-2 uppercase">{c.type.replace('prvKapital', 'Privat (Kapital)').replace('prvRente', 'Privat (Rente)').replace('bavKapital', 'bAV (Kapital)')}</td>
                           <td className="py-2 font-medium">{c.name} {isMarried ? `(${c.owner})` : ''}</td>
                           <td className="py-2 text-xs">
                              {c.type === 'etf' ? `Kapital heute: ${formatCurrency(c.capital)} | Sparrate: ${formatCurrency(c.monthly)}/M` : 
                               c.type.includes('Kapital') ? `Zielkapital: ${formatCurrency(c.gross)}` :
                               c.type === 'immobilie' ? `Kaltmiete: ${formatCurrency(c.gross)}/M` :
                               `Garantierente: ${formatCurrency(c.gross)}/M Brutto`
                              }
                           </td>
                        </tr>
                     ))}
                  </tbody>
                </table>
             </div>
           )}
        </div>

        {/* LEFT COLUMN: INPUTS */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-6 print:hidden">
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 print:shadow-none print:border-none print:p-0">
            <h2 className="text-sm font-bold mb-4 text-slate-700 border-b border-slate-100 pb-2 print:text-lg print:text-indigo-900 print:border-indigo-200">Allgemeine Daten & Ziel</h2>
            
            {isMarried && (
              <div className="flex bg-slate-100 p-1 rounded-lg mb-4 print:hidden">
                 <button onClick={()=>setPersonTab('A')} className={`flex-1 py-1.5 text-xs font-bold rounded ${personTab==='A' ? 'bg-white shadow text-indigo-700':'text-slate-500'}`}>Person A</button>
                 <button onClick={()=>setPersonTab('B')} className={`flex-1 py-1.5 text-xs font-bold rounded ${personTab==='B' ? 'bg-white shadow text-indigo-700':'text-slate-500'}`}>Person B</button>
              </div>
            )}

            {/* PERSON DATA MAPPING (For handling Print view perfectly) */}
            {['A', 'B'].filter(p => p === 'A' || isMarried).map(p => (
              <div key={`person-data-${p}`} className={`${personTab === p ? 'block' : 'hidden'} print:block mb-4`}>
                <h3 className="hidden print:block text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Daten Person {p}</h3>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Geburtsdatum {isMarried ? `(Person ${p})` : ''}</label>
                    <input type="text" placeholder="TT.MM.JJJJ" value={p === 'A' ? birthDateA : birthDateB} onChange={e => handleBirthDateChange(e.target.value, p)} className="w-full border rounded p-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Rentenbeginn {isMarried ? `(Person ${p})` : ''}</label>
                    <input type="text" placeholder="TT.MM.JJJJ" value={p === 'A' ? retDateA : retDateB} onChange={e => handleRetDateChange(e.target.value, p)} className="w-full border rounded p-2 text-sm" />
                  </div>
                </div>
                
                <div className="text-[10px] text-slate-500 mb-4 bg-slate-50 border border-slate-100 p-2 rounded flex justify-between">
                  <span>Alter heute: <strong className="text-slate-700">{(p === 'A' ? calculations.currentAgeA : calculations.currentAgeB).toFixed(1)} J.</strong></span>
                  <span>Eintrittsalter: <strong className="text-slate-700">{(p === 'A' ? calculations.retirementAgeA : calculations.retirementAgeB).toFixed(1)} J.</strong></span>
                </div>
              </div>
            ))}
            
            <div className="mb-6 p-4 bg-indigo-50/70 rounded-xl border-2 border-indigo-100 shadow-sm print:bg-indigo-50 print:border-indigo-200">
              <div className="flex justify-between items-center mb-2">
                 <label className="block text-sm font-bold text-indigo-900">Zielnetto im Alter (Kaufkraft heute)</label>
              </div>
              <input type="number" value={targetIncomeToday} onChange={e => setTargetIncomeToday(parseNum(e.target.value))} className="w-full border-2 border-indigo-200 bg-white rounded-lg p-3 text-xl font-black text-indigo-900 mb-3 shadow-inner outline-none focus:border-indigo-400 transition-colors" />
              
              <div className="border-t-2 border-indigo-200/60 pt-3 mt-3">
                 <button onClick={() => setShowBenchmark(!showBenchmark)} className="w-full flex justify-between items-center text-xs font-extrabold text-indigo-800 uppercase tracking-wide hover:opacity-80 transition-opacity print:hidden">
                   <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-indigo-600"/> Benchmark: Gehalts-Prognose</span>
                   {showBenchmark ? <ChevronUp className="w-4 h-4 text-indigo-400"/> : <ChevronDown className="w-4 h-4 text-indigo-400"/>}
                 </button>

                 {showBenchmark && (
                     <div className="mt-5 print:mt-0">
                         <div className="grid grid-cols-2 gap-4 mb-5">
                           <div>
                             <label className="block text-xs font-semibold text-slate-600 mb-1.5">Heutiges Netto (€/M)</label>
                             <input type="number" value={currentNetIncome} onChange={e => setCurrentNetIncome(parseNum(e.target.value))} className="w-full border border-indigo-200 rounded-lg p-2.5 text-sm font-bold bg-white shadow-sm outline-none focus:border-indigo-400" />
                           </div>
                           <div>
                             <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gehalts-Plus p.a. (%)</label>
                             <input type="number" step="0.1" value={wageGrowthRate} onChange={e => setWageGrowthRate(parseNum(e.target.value))} className="w-full border border-indigo-200 rounded-lg p-2.5 text-sm font-bold bg-white shadow-sm outline-none focus:border-indigo-400" />
                           </div>
                         </div>
                         
                         <div className="bg-white p-5 rounded-xl shadow-sm border border-indigo-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600 print:hidden"></div>
                            
                            <p className="text-sm text-slate-600 mb-2">Ihr Gehalt steigt bis zur Rente voraussichtlich auf:</p>
                            <div className="text-2xl font-bold text-slate-800 mb-4">{formatCurrency(calculations.projectedFinalNet)}</div>
                            
                            <div className="w-16 border-t-2 border-slate-100 mx-auto my-4"></div>
                            
                            <p className="text-sm text-slate-600 mb-2">Haushalts-Bedarf im Jahr {calculations.baseRetYear}:</p>
                            <div className="text-2xl font-bold text-indigo-600 mb-4">{formatCurrency(calculations.targetIncomeFuture)}</div>

                            <div className="w-16 border-t-2 border-slate-100 mx-auto my-4"></div>
                            
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ihr Zielnetto entspricht damit</p>
                            <div className="text-5xl font-black text-indigo-600 flex items-center justify-center gap-1 drop-shadow-sm">
                                {calculations.projectedFinalNet > 0 ? ((calculations.targetIncomeFuture / calculations.projectedFinalNet) * 100).toFixed(0) : 0} <span className="text-3xl text-indigo-400">%</span>
                            </div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2 font-bold">Ihres letzten Gehalts</p>
                         </div>
                     </div>
                 )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Krankenversicherung im Alter (Haushalt)</label>
              <select value={kvStatus} onChange={e => setKvStatus(e.target.value)} className="w-full border rounded p-2 text-sm mb-2"><option value="kvdr">Gesetzlich (KVdR - Pflicht)</option><option value="freiwillig">Gesetzlich (Freiwillig)</option><option value="pkv">Privat versichert (PKV)</option></select>
              {kvStatus === 'pkv' && <input type="number" value={pkvPremium} onChange={e => setPkvPremium(parseNum(e.target.value))} className="w-full border rounded p-2 text-sm" placeholder="Mtl. PKV-Beitrag" />}
            </div>
            
            <div className="flex flex-col gap-2 print:mb-6">
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={hasChildren} onChange={e => setHasChildren(e.target.checked)} className="rounded" /> Kinder vorhanden (PV-Zuschlag entfällt)</label>
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={hasChurchTax} onChange={e => setHasChurchTax(e.target.checked)} className="rounded" /> Kirchensteuer (8 %)</label>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
            <div className="flex border-b border-slate-200 bg-slate-50 print:hidden">
              {['s1', 's2', 's3', 'planer'].map(t => (
                <button key={t} className={`flex-1 py-3 text-[10px] sm:text-xs font-bold uppercase ${activeTab === t ? 'bg-white text-indigo-700 border-b-2 border-indigo-700' : 'text-slate-500'}`} onClick={() => setActiveTab(t)}>{t === 's1' ? 'Schicht 1' : t === 's2' ? 'Schicht 2' : t === 's3' ? 'Schicht 3' : 'Planer'}</button>
              ))}
            </div>
            <div className="p-4 bg-slate-50/50 min-h-[400px] print:min-h-0 print:p-0 print:bg-transparent">
              
              {/* SCHICHT 1 (GRV & Basisrente) */}
              <div className={`${activeTab === 's1' ? 'block' : 'hidden'} print:block print:mb-8`}>
                <h3 className="hidden print:block font-bold text-blue-900 mb-4 border-b border-blue-200 pb-1 text-lg">Eingaben: Schicht 1 (Basis)</h3>
                <div className="space-y-4">
                  
                  {/* GRV MAPPING */}
                  {['A', 'B'].filter(p => p === 'A' || isMarried).map(p => (
                    <div key={`grv-${p}`} className={`${personTab === p ? 'block' : 'hidden'} print:block print:mb-4 bg-white p-4 rounded-lg border border-blue-200 shadow-sm relative print:border-slate-300 print:shadow-none`}>
                      <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center justify-between print:text-slate-800">
                        <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 print:text-slate-500" /> Gesetzliche Rente {isMarried ? `(Person ${p})` : ''}</span>
                        <button onClick={() => estimatorPerson === p ? setEstimatorPerson(null) : openEstimator(p)} className="print:hidden text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1 transition-colors">
                          <Calculator className="w-3 h-3"/> {estimatorPerson === p ? 'Schließen' : 'Schätzen'}
                        </button>
                      </h3>

                      {estimatorPerson === p && (
                          <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-inner print:hidden">
                              <h4 className="text-[10px] font-bold text-blue-800 uppercase mb-2">Schnell-Schätzer (Karriere-Kurve)</h4>
                              <div className="mb-3">
                                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Heutiges Bruttojahresgehalt (€)</label>
                                  <input type="number" value={estimatorSalary} onChange={e => setEstimatorSalary(parseNum(e.target.value))} className="w-full border border-blue-200 rounded p-2 text-sm bg-white font-mono font-bold" />
                              </div>
                              <button onClick={() => {
                                  if (p === 'A') setGrvGrossA(estimatedPension);
                                  else setGrvGrossB(estimatedPension);
                                  setEstimatorPerson(null);
                              }} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                                  <CheckCircle className="w-3.5 h-3.5" /> ca. {estimatedPension} € übernehmen
                              </button>
                          </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Anspruch (€/M)</label><input type="number" value={p==='A'?grvGrossA:grvGrossB} onChange={e => p==='A'?setGrvGrossA(parseNum(e.target.value)):setGrvGrossB(parseNum(e.target.value))} className="w-full border rounded p-2" /></div>
                        <div><label className="block text-xs font-semibold text-slate-600 mb-1">Dynamik (%)</label><input type="number" step="0.1" value={grvIncreaseRate} onChange={e => setGrvIncreaseRate(parseNum(e.target.value))} className="w-full border rounded p-2" /></div>
                      </div>
                      {((p==='A' ? calculations.grvDiscountA : calculations.grvDiscountB) > 0) && (
                         <div className="mt-3 text-[10px] text-rose-600 bg-rose-50 p-2 rounded flex gap-1.5 border border-rose-100">
                           <AlertCircle className="w-3 h-3 shrink-0" />
                           <span>Vorruhestand: Es werden automatisch {((p==='A' ? calculations.grvDiscountA : calculations.grvDiscountB)*100).toFixed(1)}% Abschlag berechnet.</span>
                         </div>
                      )}
                    </div>
                  ))}

                  {contracts.filter(c => c.layer === 1).map(renderContractInput)}
                  <button onClick={() => addContract(1)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 hover:border-blue-400 hover:text-blue-600 print:hidden"><PlusCircle className="w-4 h-4" /> Rürup hinzufügen</button>
                </div>
              </div>

              {/* SCHICHT 2 (bAV / Riester) */}
              <div className={`${activeTab === 's2' ? 'block' : 'hidden'} print:block print:mb-8`}>
                <h3 className={`hidden ${contracts.filter(c => c.layer === 2).length > 0 ? 'print:block' : 'print:hidden'} font-bold text-purple-900 mb-4 border-b border-purple-200 pb-1 text-lg`}>Eingaben: Schicht 2 (Zusatz)</h3>
                <div className="space-y-4">
                  {contracts.filter(c => c.layer === 2).map(renderContractInput)}
                  <button onClick={() => addContract(2)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 hover:border-purple-400 hover:text-purple-600 print:hidden"><PlusCircle className="w-4 h-4" /> bAV / Riester hinzufügen</button>
                </div>
              </div>

              {/* SCHICHT 3 (Privat) */}
              <div className={`${activeTab === 's3' ? 'block' : 'hidden'} print:block print:mb-8`}>
                <h3 className={`hidden ${contracts.filter(c => c.layer === 3).length > 0 ? 'print:block' : 'print:hidden'} font-bold text-emerald-900 mb-4 border-b border-emerald-200 pb-1 text-lg`}>Eingaben: Schicht 3 (Privat)</h3>
                <div className="space-y-4">
                  {contracts.filter(c => c.layer === 3).map(renderContractInput)}
                  <button onClick={() => addContract(3)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 hover:border-emerald-400 hover:text-emerald-600 print:hidden"><PlusCircle className="w-4 h-4" /> Vertrag / Depot hinzufügen</button>
                </div>
              </div>

              {/* PLANER */}
              <div className={`${activeTab === 'planer' ? 'block' : 'hidden'} print:block`}>
                 <h3 className="hidden print:block font-bold text-indigo-900 mb-4 border-b border-indigo-200 pb-1 text-lg">Eingaben: Auszahlungs-Planer</h3>
                 <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm space-y-4 print:border-slate-300 print:shadow-none">
                      <div className="border-b border-indigo-50 pb-3 print:border-slate-200">
                        <label className="block text-xs font-bold text-indigo-900 mb-1 flex items-center gap-1.5 print:text-slate-800"><Wallet className="w-4 h-4 print:text-slate-500"/> Planer: Dynamische Verrentung</label>
                        <div className="text-[10px] text-slate-500">Bündelt Ihr Start-Kapital und übertragene Verträge, um eine passgenaue Entnahme zu berechnen.</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-[10px] font-semibold text-slate-600 mb-1 block">Start-Kapital (Manuell)</label>
                           <input type="number" value={planerCapital} onChange={e => setPlanerCapital(parseNum(e.target.value))} className="w-full border rounded p-2 text-sm font-semibold" />
                        </div>
                        <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 flex flex-col justify-center print:bg-white print:border-slate-200">
                           <label className="text-[9px] font-bold uppercase text-indigo-800 mb-0.5 print:text-slate-600">Zusammengefasstes Kapital</label>
                           <div className="font-black text-indigo-900 text-sm print:text-slate-800">{formatCurrency(calculations.effectivePlanerCapital)}</div>
                           {calculations.transferredCapital > 0 && <div className="text-[9px] text-indigo-600 font-medium mt-0.5 print:text-slate-500">inkl. {formatCurrency(calculations.transferredCapital)} aus Verträgen</div>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 pt-1">
                        <div><label className="text-[10px] font-semibold text-slate-600 mb-1 block">Dauer (Jahre)</label><input type="number" value={planerDuration} onChange={e => setPlanerDuration(parseNum(e.target.value))} className="w-full border rounded p-2 text-sm font-medium" /></div>
                        <div><label className="text-[10px] font-semibold text-slate-600 mb-1 block">Rendite p.a. (%)</label><input type="number" step="0.1" value={planerReturn} onChange={e => setPlanerReturn(parseNum(e.target.value))} className="w-full border rounded p-2 text-sm font-medium" /></div>
                        <div><label className="text-[10px] font-semibold text-slate-600 mb-1 block">Dyn. p.a. (%)</label><input type="number" step="0.1" value={planerDynamic} onChange={e => setPlanerDynamic(parseNum(e.target.value))} className="w-full border rounded p-2 text-sm font-medium" /></div>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 flex justify-between items-center mt-2 shadow-inner print:bg-white print:border-slate-200 print:shadow-none">
                         <label className="flex items-center gap-2 text-[10px] font-bold text-emerald-900 cursor-pointer print:text-slate-800"><input type="checkbox" checked={includePlanerInNet} onChange={e=>setIncludePlanerInNet(e.target.checked)} className="rounded text-emerald-600" /> Mtl. Entnahme ins Netto</label>
                         <div className="text-right">
                            <div className="text-xl font-black text-emerald-700 print:text-slate-800">{formatCurrency(calculations.finalPlanerWithdrawal)}</div>
                            {calculations.planerTax > 0 && <div className="text-[9px] text-emerald-600 font-medium print:text-slate-500">Netto (nach {formatCurrency(calculations.planerTax + (calculations.planerKist || 0))} Steuer)</div>}
                         </div>
                      </div>
                    </div>
                 </div>
              </div>

            </div>
            <div className="p-4 bg-white border-t print:hidden"><button onClick={loadDemoData} className="w-full border border-dashed rounded p-2 text-sm bg-blue-50 text-blue-700">Demo-Daten laden</button></div>
          </div>
        </div>

        {/* RIGHT COLUMN: RESULTS */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-6 print:col-span-12">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:mt-0">
            <h2 className="hidden print:block col-span-1 sm:col-span-2 text-xl font-bold uppercase tracking-widest border-b-2 border-slate-200 pb-2 mb-4 text-slate-800 mt-4 break-inside-avoid">2. Ergebnis: Ihr Kassenbon im Rentenalter</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 mb-1">Haushalts-Bedarf im Jahr {calculations.baseRetYear}</h3>
              <div className="text-3xl font-bold">{renderBonVal(calculations.targetIncomeFuture)}</div>
            </div>
            <div className={`bg-white rounded-xl shadow-sm border p-6 ${calculations.gap > 0 ? 'border-rose-200 text-rose-600' : 'border-emerald-200 text-emerald-600'}`}>
              <h3 className="text-sm font-semibold mb-1">Rentenlücke</h3>
              <div className="text-3xl font-bold">{calculations.gap > 0 ? renderBonVal(calculations.gap) : 'Gedeckt'}</div>
            </div>
          </div>

          {/* STEUER-ENGINE TOGGLE */}
          <div className="bg-slate-800 text-slate-200 rounded-xl shadow-sm border border-slate-700 overflow-hidden print:hidden">
            <button onClick={() => setShowTaxInfo(!showTaxInfo)} className="w-full p-4 flex justify-between items-center hover:bg-slate-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400"><Calculator className="w-5 h-5" /></div>
                <div className="text-left">
                  <div className="font-bold text-sm text-white">Steuer- & Abgaben-Engine</div>
                  <div className="text-[10px] text-slate-400">Transparente Ansicht der Progressions- & KV/PV-Berechnung</div>
                </div>
              </div>
              {showTaxInfo ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
            </button>

            {showTaxInfo && (
              <div className="p-4 bg-slate-900 border-t border-slate-700 text-xs space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-800 p-3 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase mb-1">Steuer-Basis (zvE)</div>
                    <div className="text-lg font-bold text-white">{formatCurrency(calculations.zvE_yearly)}</div>
                    <div className="text-[9px] text-slate-500 mt-1">Jährl. zu versteuerndes Einkommen</div>
                  </div>
                  <div className="bg-slate-800 p-3 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase mb-1">Durchschnittssteuer</div>
                    <div className="text-lg font-bold text-emerald-400">{(calculations.avgTaxRate * 100).toFixed(1)} %</div>
                    <div className="text-[9px] text-slate-500 mt-1">Ihre reale prozentuale Belastung</div>
                  </div>
                  <div className="bg-slate-800 p-3 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase mb-1">Grenzsteuersatz</div>
                    <div className="text-lg font-bold text-rose-400">{(calculations.marginalTaxRate * 100).toFixed(1)} %</div>
                    <div className="text-[9px] text-slate-500 mt-1">Steuer auf jeden weiteren Euro</div>
                  </div>
                  <div className="bg-slate-800 p-3 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase mb-1">KV/PV Abzug (p.a.)</div>
                    <div className="text-lg font-bold text-white">{formatCurrency(calculations.deductible_kvpv * 12)}</div>
                    <div className="text-[9px] text-slate-500 mt-1">Mindert das zvE (Steuervorteil)</div>
                  </div>
                </div>
                
                <div className="bg-indigo-900/30 border border-indigo-500/30 p-3 rounded-lg flex gap-3 items-start">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-indigo-200 leading-relaxed">
                    <strong>So rechnet die Engine im Hintergrund:</strong> Die App summiert alle steuerpflichtigen Einkünfte aus Schicht 1, 2 und 3. 
                    Gesetzliche Renten werden automatisch mit dem Kohorten-Besteuerungsanteil für das Jahr {calculations.baseRetYear} angesetzt. 
                    Private Renten (Schicht 3) werden nach § 22 EStG nur mit dem Ertragsanteil von {isMarried ? 'ca. 17%' : '17%'} (bei Alter 67) besteuert. 
                    Anschließend werden die berechneten Kranken- und Pflegeversicherungsbeiträge steuermindernd abgezogen, bevor der 
                    progressiv ansteigende EStG-Tarif (inkl. {isMarried ? 'Ehegattensplitting' : 'Grundtarif'} und {taxIndexRate}% p.a. Tarif-Indexierung) angewendet wird.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex bg-slate-200/50 p-1 rounded border print:hidden">
            <button onClick={() => setRightView('zusammensetzung')} className={`flex-1 py-2 rounded text-xs font-bold flex justify-center gap-2 ${rightView === 'zusammensetzung' ? 'bg-white shadow' : 'text-slate-500'}`}><List className="w-4 h-4" /> Kassenbon</button>
            <button onClick={() => setRightView('verlauf')} className={`flex-1 py-2 rounded text-xs font-bold flex justify-center gap-2 ${rightView === 'verlauf' ? 'bg-white shadow' : 'text-slate-500'}`}><LineChartIcon className="w-4 h-4" /> Verlauf</button>
          </div>

          {/* KASSENBON */}
          <div className={`bg-white rounded-xl shadow-sm border p-6 print:block print:break-inside-avoid ${rightView === 'zusammensetzung' ? 'block' : 'hidden'}`}>
            <h2 className="text-sm font-bold mb-4 print:hidden">Ihr Haushalts-Netto im Jahr {calculations.baseRetYear}</h2>
            
            {/* FORTSCHRITTSBALKEN (DECKUNG) */}
            <div className="mb-6 print:mt-4">
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mb-1">
                <span>Ziel-Erreichung</span>
                <span>{calculations.gap > 0 && calculations.targetIncomeFuture > 0 ? `${((calculations.totalNetFuture / calculations.targetIncomeFuture) * 100).toFixed(1)} % erreicht` : 'Ziel erreicht / übertroffen'}</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full flex overflow-hidden shadow-inner border border-slate-200">
                {(calculations.s1_net > 0) && <div style={{ width: `${(calculations.s1_net / Math.max(calculations.targetIncomeFuture, calculations.totalNetFuture) || 1) * 100}%` }} className="bg-blue-500 transition-all duration-500" title={`Schicht 1: ${formatCurrency(calculations.s1_net)}`}></div>}
                {(calculations.s2_net > 0) && <div style={{ width: `${(calculations.s2_net / Math.max(calculations.targetIncomeFuture, calculations.totalNetFuture) || 1) * 100}%` }} className="bg-purple-500 transition-all duration-500" title={`Schicht 2: ${formatCurrency(calculations.s2_net)}`}></div>}
                {(calculations.s3_net > 0) && <div style={{ width: `${(calculations.s3_net / Math.max(calculations.targetIncomeFuture, calculations.totalNetFuture) || 1) * 100}%` }} className="bg-emerald-500 transition-all duration-500" title={`Schicht 3: ${formatCurrency(calculations.s3_net)}`}></div>}
                {(calculations.gap > 0) && <div style={{ width: `${(calculations.gap / Math.max(calculations.targetIncomeFuture, calculations.totalNetFuture) || 1) * 100}%` }} className="bg-white transition-all duration-500" title={`Lücke: ${formatCurrency(calculations.gap)}`}></div>}
              </div>
              <div className="flex gap-3 mt-2 text-[9px] font-semibold text-slate-500 flex-wrap">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Schicht 1</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Schicht 2</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Schicht 3</div>
                {calculations.gap > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white border border-slate-300"></span> Lücke</div>}
              </div>
            </div>

            <div className="space-y-3">
              <div className="border border-blue-100 rounded-lg print:border-slate-300">
                <div className="flex justify-between p-3 bg-blue-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s1')}>
                  <div className="font-bold text-sm text-blue-900">Schicht 1 (Basis)</div>
                  <div className="font-bold">{renderBonVal(calculations.s1_net)}</div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-blue-100 space-y-2 ${expandedSections.s1 ? 'block' : 'hidden'} print:block print:space-y-0 print:border-t-0 print:p-0 print:mt-3`}>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2 break-inside-avoid">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-semibold text-sm text-blue-900">Gesetzliche Rente (Haushalt)</div>
                      <div className="font-bold text-base text-slate-800">{renderBonVal(calculations.grvNet)}</div>
                    </div>
                    <div className="flex justify-between items-end text-[10px] text-slate-500">
                      <div>Brutto: {formatResultCurrency(calculations.grvFutureGrossTotal)}</div>
                      <div className="text-rose-500 text-right leading-tight">KV/PV: {formatResultCurrency(calculations.grvKvpv)} | ESt: {formatResultCurrency(calculations.grvESt + calculations.grvKist)}</div>
                    </div>
                  </div>
                  {calculations.contracts.filter(c=>c.layer===1).map(c => renderBonContract(c))}
                </div>
              </div>

              <div className="border border-purple-100 rounded-lg print:border-slate-300">
                <div className="flex justify-between p-3 bg-purple-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s2')}>
                  <div className="font-bold text-sm text-purple-900">Schicht 2 (Zusatz)</div>
                  <div className="font-bold">{renderBonVal(calculations.s2_net)}</div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-purple-100 space-y-2 ${expandedSections.s2 ? 'block' : 'hidden'} print:block print:space-y-0 print:border-t-0 print:p-0 print:mt-3`}>
                   {calculations.contracts.filter(c=>c.layer===2).map(c => renderBonContract(c))}
                </div>
              </div>

              <div className="border border-emerald-100 rounded-lg print:border-slate-300">
                <div className="flex justify-between p-3 bg-emerald-50/50 cursor-pointer print:bg-slate-100" onClick={() => toggleSection('s3')}>
                  <div className="font-bold text-sm text-emerald-900">Schicht 3 (Privat)</div>
                  <div className="font-bold">{renderBonVal(calculations.s3_net)}</div>
                </div>
                <div className={`p-3 bg-white text-xs border-t border-emerald-100 space-y-2 ${expandedSections.s3 ? 'block' : 'hidden'} print:block print:space-y-0 print:border-t-0 print:p-0 print:mt-3`}>
                  {calculations.contracts.filter(c=>c.layer===3).map(c => renderBonContract(c))}
                  {includePlanerInNet && (
                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-2 break-inside-avoid">
                       <div className="flex justify-between items-center mb-1">
                         <div className="font-semibold text-sm text-indigo-900">Planer Wunsch-Rente</div>
                         <div className="font-bold text-base text-indigo-900">{renderBonVal(calculations.finalPlanerWithdrawal)}</div>
                       </div>
                       <div className="flex justify-between items-end text-[10px] text-indigo-700/70">
                         <div>Brutto: {formatResultCurrency(calculations.finalPlanerWithdrawalGross)}</div>
                         {calculations.planerTax > 0 && <div className="text-rose-500 text-right leading-tight">Abgeltung: {formatResultCurrency(calculations.planerTax + (calculations.planerKist || 0))}</div>}
                       </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between p-4 mt-4 rounded bg-slate-900 text-white print:bg-slate-100 print:text-slate-800 print:border break-inside-avoid">
                <div className="font-bold text-lg">Erwartetes Gesamt-Netto</div>
                <div className="font-bold text-xl">{renderBonVal(calculations.totalNetFuture)}</div>
              </div>
            </div>
          </div>

          {/* CHART */}
          <div className={`bg-white rounded-xl border p-6 h-auto print:block print:mt-8 print:break-inside-avoid ${rightView === 'verlauf' ? 'block' : 'hidden'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold">Einkommensverlauf (Netto / Monat)</h2>
              <div className="flex gap-3 text-[10px] font-semibold text-slate-500 print:hidden">
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400"></span> Gehalt</div>
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span> Rente</div>
                <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500"></span> Zielbedarf</div>
              </div>
            </div>
            <div className="w-full h-[280px] relative" onMouseLeave={() => setHoveredData(null)}>
              {hoveredData && (
                  <div className="absolute bg-white border border-slate-200 shadow-xl rounded-lg p-3 text-xs z-10 pointer-events-none print:hidden transition-all duration-100"
                       style={{ 
                           left: `${(hoveredData.cx / svgWidth) * 100}%`, 
                           top: '20px', 
                           transform: hoveredData.index > visibleChartData.length / 2 ? 'translateX(calc(-100% - 15px))' : 'translateX(15px)' 
                       }}>
                      <div className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Alter {hoveredData.age} (Jahr {hoveredData.year})</div>
                      {!hoveredData.isRetirement ? (
                          <div className="text-slate-600 flex justify-between gap-4"><span>Gehalt (Netto):</span> <span className="font-bold">{formatChartCurrency(hoveredData.totalNet, hoveredData.discount)}</span></div>
                      ) : (
                          <>
                              <div className="text-indigo-600 flex justify-between gap-4 mb-1"><span>Gesamt-Netto:</span> <span className="font-bold">{formatChartCurrency(hoveredData.totalNet, hoveredData.discount)}</span></div>
                              {includePlanerInNet && hoveredData.planer > 0 && <div className="text-[10px] text-slate-500 flex justify-between gap-4"><span>davon Planer:</span> <span>{formatChartCurrency(hoveredData.planer, hoveredData.discount)}</span></div>}
                          </>
                      )}
                      <div className="text-amber-600 mt-2 pt-1 border-t border-slate-100 flex justify-between gap-4"><span>Bedarf (Ziel):</span> <span className="font-bold">{formatChartCurrency(hoveredData.target, hoveredData.discount)}</span></div>
                  </div>
              )}
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible print:text-slate-800">
                {yTicks.map((val, i) => (
                  <g key={`y-${i}`}>
                    <line x1={paddingX} y1={getY(val)} x2={svgWidth - paddingX} y2={getY(val)} stroke="#e2e8f0" strokeWidth="1" />
                    <text x={paddingX - 10} y={getY(val) + 4} fontSize="13" fontWeight="bold" fill="#64748b" textAnchor="end">{formatYAxis(val)}</text>
                  </g>
                ))}
                
                {visibleChartData.map((d, i) => {
                  const cx = paddingX + i * stepX + stepX / 2;
                  const val = showRealValue ? (d.totalNet / (d.discount || 1)) : d.totalNet;
                  const h = Math.max(0, (val / maxY) * graphHeight);
                  const yPos = svgHeight - bottomPadding - h;
                  const barColor = !d.isRetirement ? '#94a3b8' : '#6366f1'; 

                  return (
                    <g key={`bar-${i}`}>
                      <rect x={cx - barWidth/2} y={yPos} width={barWidth} height={h} fill={barColor} rx="2" className="transition-all duration-300" opacity={hoveredData && hoveredData.index !== i ? 0.5 : 1} />
                      {(i === 0 || d.year === calculations.baseRetYear || d.age % 5 === 0 || i === visibleChartData.length - 1) && (
                        <>
                           <text x={cx} y={svgHeight - 10} fontSize="12" fontWeight="bold" fill="#64748b" textAnchor="middle">{d.age} J.</text>
                           <line x1={cx} y1={svgHeight - bottomPadding} x2={cx} y2={svgHeight - bottomPadding + 5} stroke="#cbd5e1" />
                        </>
                      )}
                    </g>
                  );
                })}

                <line x1={paddingX} y1={svgHeight - bottomPadding} x2={svgWidth - paddingX} y2={svgHeight - bottomPadding} stroke="#94a3b8" strokeWidth="2" />
                
                <path d={targetPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 4" />

                {visibleChartData.map((d, i) => {
                  const cx = paddingX + i * stepX + stepX / 2;
                  return <rect key={`hover-${i}`} x={cx - stepX/2} y={0} width={stepX} height={svgHeight - bottomPadding} fill="transparent" onMouseEnter={() => setHoveredData({ ...d, index: i, cx })} className="cursor-crosshair print:hidden" />;
                })}
              </svg>
            </div>
            
            {/* NEU: ZEITREISEN-SLIDER */}
            <div className="mt-8 flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 print:hidden shadow-inner">
               <span className="text-xs font-bold text-slate-500 whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm">Alter {Math.floor(calculations.currentAgeA)}</span>
               <div className="flex-1 relative">
                 <input 
                    type="range" 
                    min={Math.floor(calculations.currentAgeA)} 
                    max={105 - chartWindowSize} 
                    value={activeStartAge} 
                    onChange={e => setManualChartStart(Number(e.target.value))} 
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                 />
                 <div className="text-[10px] text-center text-slate-400 font-medium mt-1 uppercase tracking-wider">Zeitleiste verschieben</div>
               </div>
               <span className="text-xs font-bold text-slate-500 whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm">Alter 105</span>
               <div className="w-px h-6 bg-slate-300 mx-1"></div>
               <button 
                  onClick={() => setManualChartStart(null)} 
                  className="text-xs flex items-center gap-1.5 bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-100 hover:text-indigo-600 transition-all shadow-sm"
                  title="Zurück zum Renteneintritt springen"
               >
                  <Clock className="w-3.5 h-3.5" /> Fokus Rente
               </button>
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

      {/* PRINT ONLY: STEUER- & ABGABEN-EXKURS */}
      {printExplanationMode !== 'none' && (
        <div className="hidden print:block max-w-6xl mx-auto p-6 mt-8 break-before-page text-slate-800">
          <h2 className="text-2xl font-bold uppercase tracking-widest border-b-2 border-slate-200 pb-2 mb-6 text-indigo-900">Exkurs: Steuerliche & Rechtliche Grundlagen</h2>

          <div className="print:columns-2 print:gap-8 text-sm leading-relaxed">
            {printExplanationMode === 'short' ? (
               <>
                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-1 text-slate-900">1. Schicht 1 (Gesetzliche Rente & Basisrente)</h3>
                     <p>Diese Schicht unterliegt der <strong>nachgelagerten Kohortenbesteuerung</strong>. Der steuerpflichtige Anteil richtet sich nach dem Jahr Ihres Renteneintritts (z. B. 84 % im Jahr 2026). Die verbleibenden steuerfreien 16 % werden im ersten Rentenjahr als absoluter Euro-Betrag auf Lebenszeit eingefroren. Alle künftigen Rentenerhöhungen (Inflationsausgleich) sind somit zu 100 % steuerpflichtig. In der KVdR fallen hierauf Beiträge zur Kranken- und Pflegeversicherung an.</p>
                  </div>
                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-1 text-slate-900">2. Schicht 2 (Betriebliche Altersvorsorge & Riester)</h3>
                     <p>Betriebs- und Riester-Renten sind in der Auszahlungsphase <strong>voll einkommensteuerpflichtig</strong>. Bei Betriebsrenten (bAV) aus einer Entgeltumwandlung müssen gesetzlich Versicherte in der Auszahlungsphase zudem die <strong>vollen Beiträge zur Kranken- und Pflegeversicherung</strong> (Arbeitnehmer- und Arbeitgeberanteil) abführen. Dies mindert die reale Rendite von Verträgen ohne hohen Arbeitgeberzuschuss oft spürbar.</p>
                  </div>
                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-1 text-slate-900">3. Schicht 3 (Private Renten, Immobilien & ETFs)</h3>
                     <p>Diese Verträge sind im Alter steuerlich stark begünstigt. Bei einer lebenslangen privaten Rente greift die <strong>Ertragsanteilsbesteuerung</strong> (bei Renteneintritt mit 67 Jahren sind nur 17 % der Rente steuerpflichtig). Depotentnahmen unterliegen der Abgeltungsteuer (25 % zzgl. Soli), wobei Aktien-ETFs eine <strong>Teilfreistellung von 30 %</strong> (komplett steuerfrei) genießen. Zudem sind Auszahlungen aus der Schicht 3 für Pflichtversicherte in der KVdR komplett kranken- und pflegeversicherungsfrei.</p>
                  </div>
               </>
            ) : (
               <>
                  <p className="font-semibold text-slate-600 mb-6 break-inside-avoid">Dieses erweiterte Gutachten basiert auf der aktuellen Steuer- und Sozialgesetzgebung der Bundesrepublik Deutschland (Stand 2026) und projiziert diese durch mathematische Indexierungs-Parameter in die Zukunft.</p>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">1. Grundfreibetrag & Tarif-Indexierung</h3>
                     <p className="mb-2">Der steuerliche Grundfreibetrag sichert das Existenzminimum. Im Jahr 2026 liegt dieser bei <strong>12.348 € für Ledige</strong> (24.696 € für Verheiratete). Um die sogenannte "kalte Progression" (heimliche Steuererhöhung durch Inflation) auszugleichen, wird dieser Betrag regelmäßig angehoben.</p>
                     <p className="mb-2"><strong>Historische Entwicklung:</strong> Vor 20 Jahren (2006) lag der Freibetrag noch bei 7.664 €. Das entspricht einer durchschnittlichen historischen Steigerung von rund 2,4 % pro Jahr.</p>
                     <p className="mb-2"><strong>Ihre Prognose (mit {taxIndexRate.toLocaleString("de-DE")} % p.a. Indexierung):</strong></p>
                     <ul className="list-disc pl-5 mb-2 text-slate-700 space-y-1">
                        <li>In 20 Jahren (2046): ca. <strong>{formatCurrency(12348 * Math.pow(1 + taxIndexRate / 100, 20))}</strong> <span className="text-slate-500">({formatCurrency(24696 * Math.pow(1 + taxIndexRate / 100, 20))} Verheiratet)</span></li>
                        <li>In 30 Jahren (2056): ca. <strong>{formatCurrency(12348 * Math.pow(1 + taxIndexRate / 100, 30))}</strong> <span className="text-slate-500">({formatCurrency(24696 * Math.pow(1 + taxIndexRate / 100, 30))} Verheiratet)</span></li>
                        <li>In 40 Jahren (2066): ca. <strong>{formatCurrency(12348 * Math.pow(1 + taxIndexRate / 100, 40))}</strong> <span className="text-slate-500">({formatCurrency(24696 * Math.pow(1 + taxIndexRate / 100, 40))} Verheiratet)</span></li>
                     </ul>
                     <p className="text-xs text-indigo-800 bg-indigo-50 p-2 rounded mt-3">Diese dynamische Anpassung ist in der Steuer-Engine dieser Auswertung vollständig integriert und schützt Ihre zukünftige Kaufkraft in der Berechnung vor unrealistischen Steuerlasten.</p>
                  </div>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">2. Ehegattensplitting</h3>
                     <p className="mb-4">Das deutsche Steuerrecht erlaubt für zusammen veranlagte Ehepaare das Splittingverfahren. Dabei werden die steuerpflichtigen Einkünfte beider Partner (nach Abzug aller Freibeträge) in einen Topf geworfen, addiert und anschließend halbiert. Auf diese eine Hälfte wird der Einkommensteuertarif angewendet. Die daraus resultierende Steuer wird am Ende verdoppelt.</p>
                     <p className="mb-2"><strong>Der mathematische Hebel:</strong> Dieser Mechanismus ist in der Altersvorsorge enorm wertvoll, wenn ein Partner eine deutlich höhere Rente bezieht als der andere (z. B. durch Erziehungszeiten oder Teilzeit). Durch das fiktive "Teilen" des Einkommens wird die harte Steuerprogression des Besserverdienenden massiv abgemildert.</p>
                     <div className={`p-2 rounded text-xs font-bold border mt-3 ${isMarried ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                         Status für diese Auswertung: {isMarried ? 'Splitting-Verfahren für Ehepaare ist AKTIVIERT.' : 'Grundtarif für Einzelveranlagung (Single) ist AKTIVIERT.'}
                     </div>
                  </div>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">3. Krankenversicherung der Rentner (KVdR)</h3>
                     <p>Die KVdR ist keine eigenständige Kasse, sondern ein begehrter Versichertenstatus. Erreicht wird er über die "9/10-Regelung" (mind. 90 % der zweiten Erwerbslebenshälfte gesetzlich versichert). Der gravierende Vorteil: KVdR-Mitglieder zahlen KV/PV-Beiträge <strong>nur auf gesetzliche Renten und Betriebsrenten</strong>. Einkünfte aus Kapitalvermögen (ETFs, private Renten) oder Vermietung bleiben zu 100 % beitragsfrei.</p>
                  </div>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">4. Kohortenbesteuerung (Schicht 1)</h3>
                     <p>Gemäß Alterseinkünftegesetz steigt die Steuerpflicht für gesetzliche Renten und Rürup-Renten sukzessive an. Wer 2026 in Rente geht, muss 84 % seiner ersten vollen Jahresrente versteuern. Die restlichen 16 % werden als <strong>absoluter Euro-Betrag auf Lebenszeit eingefroren</strong>. Die Konsequenz: Jede zukünftige gesetzliche Rentenerhöhung erhöht das zu versteuernde Einkommen unmittelbar zu 100 %.</p>
                  </div>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">5. Betriebsrenten & Doppelverbeitragung</h3>
                     <p>Die betriebliche Altersvorsorge (bAV) mindert in der Erwerbsphase Steuern und Sozialabgaben. Im Alter dreht sich dies um: bAV-Renten sind voll steuerpflichtig. Gravierender ist die Sozialversicherungspflicht: Rentner müssen hierauf den <strong>vollen Kranken- und Pflegeversicherungsbeitrag (ca. 19 - 20 %)</strong> abführen (abzgl. eines kleinen Freibetrags). Dies ist die sogenannte Doppelverbeitragung.</p>
                  </div>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">6. Steuerprivilegien in Schicht 3</h3>
                     <p className="mb-2"><strong>Private Leibrenten:</strong> Unterliegen nur der Ertragsanteilsbesteuerung nach § 22 EStG. Geht man mit 67 in Rente, rechnet das Finanzamt fiktiv nur ca. 17 % der Rente als steuerpflichtiges Einkommen an.</p>
                     <p className="mb-2"><strong>Kapitalauszahlungen:</strong> Bei Laufzeiten über 12 Jahren und Auszahlung ab Alter 62 greift das <strong>Halbeinkünfteverfahren</strong>. 50 % des Gewinns sind steuerfrei, die andere Hälfte unterliegt dem persönlichen Steuersatz.</p>
                     <p><strong>ETF-Depots:</strong> Realisierte Kursgewinne unterliegen der Abgeltungsteuer (25 % + Soli). Bei reinen Aktien-ETFs bleiben durch das Investmentsteuergesetz (Teilfreistellung) <strong>30 % aller Gewinne komplett steuerfrei</strong>.</p>
                  </div>
               </>
            )}
          </div>
          <div className="mt-8 text-[10px] text-slate-400 text-center border-t border-slate-200 pt-4 font-semibold uppercase tracking-wider">
              Hinweis: Alle Berechnungen in diesem Dokument sind softwaregestützte Simulationen und ersetzen keine rechtsverbindliche Steuerberatung. Stand der Steuergesetzgebung: 2026.
          </div>
        </div>
      )}

    </div>
  );
}