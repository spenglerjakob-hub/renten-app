import React, { useState, useMemo, useRef } from 'react';
import { 
  Upload, FileText, TrendingUp, AlertCircle, Calculator, 
  CheckCircle, ChevronDown, ChevronUp, ShieldAlert, PiggyBank, 
  Briefcase, PlusCircle, Trash, Users, User, Info, Coins, Clock, Infinity as InfinityIcon, Wallet, Activity,
  LineChart as LineChartIcon, List, Download, Home, Save, FolderOpen, Zap,
  Eye, Compass, Target, Search, Percent, SearchCheck, ArrowRight, Landmark
} from 'lucide-react';

// Helper für Input-Zahlen
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

// --- BEAMTEN-BESOLDUNG (Approximation 2025/2026 Basis) ---
const besoldungsgruppen = ['A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'B1', 'B2', 'B3'];
const besoldungsLaender = { 
  'Bund': 1.05, 'Baden-Württemberg': 1.04, 'Bayern': 1.05, 'Berlin': 0.98, 'Brandenburg': 0.99, 
  'Bremen': 1.0, 'Hamburg': 1.03, 'Hessen': 1.04, 'Mecklenburg-Vorpommern': 0.98, 'Niedersachsen': 1.0, 
  'Nordrhein-Westfalen': 1.0, 'Rheinland-Pfalz': 1.01, 'Saarland': 0.99, 'Sachsen': 1.02, 
  'Sachsen-Anhalt': 0.99, 'Schleswig-Holstein': 1.0, 'Thüringen': 0.99 
};

const getBesoldung = (gruppe, stufe, land, isMarried, hasChildren) => {
  const baseData = {
    'A7': { b: 2700, s: 90 }, 'A8': { b: 2900, s: 100 }, 'A9': { b: 3200, s: 110 },
    'A10': { b: 3400, s: 130 }, 'A11': { b: 3800, s: 140 }, 'A12': { b: 4100, s: 160 },
    'A13': { b: 4700, s: 180 }, 'A14': { b: 4900, s: 210 }, 'A15': { b: 5800, s: 250 },
    'A16': { b: 6400, s: 280 }, 'B1': { b: 7200, s: 0 }, 'B2': { b: 8500, s: 0 }, 'B3': { b: 9000, s: 0 }
  };
  const d = baseData[gruppe] || baseData['A13'];
  let salary = d.b + (Math.max(1, stufe) - 1) * d.s;
  salary *= (besoldungsLaender[land] || 1.0);
  
  // Familienzuschlag Approximation
  if (isMarried) salary += 150;
  if (hasChildren) salary += 300; 
  return salary;
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

// Helper für exakte Datumsdifferenzen
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

const formatDateInput = (value) => {
  const cleaned = value.replace(/\D/g, '');
  let formatted = '';
  if (cleaned.length > 0) formatted += cleaned.substring(0, 2);
  if (cleaned.length > 2) formatted += '.' + cleaned.substring(2, 4);
  if (cleaned.length > 4) formatted += '.' + cleaned.substring(4, 8);
  return formatted;
};

export default function App() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // --- STATE MANAGEMENT ---
  const [isMarried, setIsMarried] = useState(false); 
  const [showRealValue, setShowRealValue] = useState(false);
  const [targetIncomeToday, setTargetIncomeToday] = useState(2000); 
  const [hasChurchTax, setHasChurchTax] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);
  const [kvStatus, setKvStatus] = useState('kvdr'); 
  const [pkvPremium, setPkvPremium] = useState(600);

  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');

  // --- Gehalts-Modul ---
  const [salaryInputMode, setSalaryInputMode] = useState('netto');
  const [salaryInputValue, setSalaryInputValue] = useState(2500);
  const [salaryMultiplier, setSalaryMultiplier] = useState(12);
  
  // --- Beamten-Modul States ---
  const [besoldungLand, setBesoldungLand] = useState('Bund');
  const [besoldungGruppe, setBesoldungGruppe] = useState('A13');
  const [besoldungStufe, setBesoldungStufe] = useState(4);

  const [wageGrowthRate, setWageGrowthRate] = useState(2.0);

  const [birthDateA, setBirthDateA] = useState('01.01.1995');
  const [retDateA, setRetDateA] = useState('01.01.2062');
  const [pensionTypeA, setPensionTypeA] = useState('grv'); 
  const [grvGrossA, setGrvGrossA] = useState(0);
  const [pensionEndGruppeA, setPensionEndGruppeA] = useState('A14');
  const [pensionEndStufeA, setPensionEndStufeA] = useState(8);
  const [pensionSatzA, setPensionSatzA] = useState(71.75);
  
  const [birthDateB, setBirthDateB] = useState('01.01.1991');
  const [retDateB, setRetDateB] = useState('01.01.2058');
  const [pensionTypeB, setPensionTypeB] = useState('grv');
  const [grvGrossB, setGrvGrossB] = useState(0);
  const [pensionEndGruppeB, setPensionEndGruppeB] = useState('A13');
  const [pensionEndStufeB, setPensionEndStufeB] = useState(8);
  const [pensionSatzB, setPensionSatzB] = useState(71.75);

  const [grvIncreaseRate, setGrvIncreaseRate] = useState(0);
  const [inflationRate, setInflationRate] = useState(2.0);
  const [taxIndexRate, setTaxIndexRate] = useState(1.0);
  const [solutionSavingsReturn, setSolutionSavingsReturn] = useState(5.0);
  const [solutionSavingsDynamic, setSolutionSavingsDynamic] = useState(0.0);
  const [contracts, setContracts] = useState([]);

  // UI States
  const [activeTab, setActiveTab] = useState('s1');
  const [personTab, setPersonTab] = useState('A'); 
  const [expandedSections, setExpandedSections] = useState({ s1: true, s2: true, s3: true });
  const [rightView, setRightView] = useState('zusammensetzung'); 
  const [hoveredData, setHoveredData] = useState(null); 
  const [showTaxInfo, setShowTaxInfo] = useState(false); 
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [printExplanationMode, setPrintExplanationMode] = useState('short'); 
  const [manualChartStart, setManualChartStart] = useState(null); 

  // --- VERTRAGS-TÜV STATES ---
  const [tuevItems, setTuevItems] = useState([]);

  const addTuevItem = (contractId) => {
      const c = contracts.find(x => x.id === parseInt(contractId));
      if (!c) return;
      const currentYear = new Date().getFullYear();
      const newItem = {
          id: Date.now(), contractId: c.id, grossMonthly: c.monthlyPremium || c.monthly || 100, dynamic: c.dynamic || 0,
          subsidyBav: 50, subsidyRiester: 175, children: [], startDate: `01.01.${currentYear}`, lifeExpectancy: 85
      };
      setTuevItems(prev => [...prev, newItem]);
  };
  const updateTuevItem = (id, field, value) => setTuevItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  const removeTuevItem = (id) => setTuevItems(prev => prev.filter(item => item.id !== id));
  const addTuevChild = (tuevId) => setTuevItems(prev => prev.map(item => item.id === tuevId ? { ...item, children: [...(item.children || []), { id: Date.now(), birthYear: new Date().getFullYear() }] } : item));
  const updateTuevChild = (tuevId, childId, field, value) => setTuevItems(prev => prev.map(item => item.id === tuevId ? { ...item, children: item.children.map(c => c.id === childId ? { ...c, [field]: value } : c) } : item));
  const removeTuevChild = (tuevId, childId) => setTuevItems(prev => prev.map(item => item.id === tuevId ? { ...item, children: item.children.filter(c => c.id !== childId) } : item));

  // --- RENTEN-SCHÄTZER ---
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
    const growthEndAge = Math.max(startAge, Math.floor(currentAge));
    const yearsOfGrowth = growthEndAge - startAge;
    
    for (let age = startAge; age < endAge; age++) {
       let yearSalary = estimatorSalary;
       if (age < growthEndAge && yearsOfGrowth > 0) {
           const startRatio = 0.5;
           const growthRate = Math.pow(1 / startRatio, 1 / yearsOfGrowth) - 1;
           yearSalary = estimatorSalary * startRatio * Math.pow(1 + growthRate, age - startAge);
       }
       const cappedSalary = Math.min(yearSalary, 101400); 
       totalPunkte += cappedSalary / 51944; 
    }
    return Math.round(totalPunkte * 42.52); 
  }, [estimatorSalary, estimatorPerson, birthDateA, birthDateB, retDateA, retDateB]);

  const openEstimator = (person) => setEstimatorPerson(person);

  const [planerCapital, setPlanerCapital] = useState(0);
  const [planerDuration, setPlanerDuration] = useState(25);
  const [planerReturn, setPlanerReturn] = useState(3.0);
  const [planerDynamic, setPlanerDynamic] = useState(0.0);
  const [includePlanerInNet, setIncludePlanerInNet] = useState(false);

  const fileInputRef = useRef(null);

  const toggleSection = (sec) => setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));

  const handleBirthDateChange = (val, person) => {
     const formatted = formatDateInput(val);
     if (person === 'A') {
         setBirthDateA(formatted);
         if (formatted.length === 10) {
             const y = parseInt(formatted.substring(6, 10), 10);
             let m = parseInt(formatted.substring(3, 5), 10);
             const d = parseInt(formatted.substring(0, 2), 10);
             let retYear = y + 67;
             if (d > 1) m += 1;
             if (m > 12) { m = 1; retYear += 1; }
             setRetDateA(`01.${String(m).padStart(2, '0')}.${retYear}`);
         }
     } else {
         setBirthDateB(formatted);
         if (formatted.length === 10) {
             const y = parseInt(formatted.substring(6, 10), 10);
             let m = parseInt(formatted.substring(3, 5), 10);
             const d = parseInt(formatted.substring(0, 2), 10);
             let retYear = y + 67;
             if (d > 1) m += 1;
             if (m > 12) { m = 1; retYear += 1; }
             setRetDateB(`01.${String(m).padStart(2, '0')}.${retYear}`);
         }
     }
  };

  const handleRetDateChange = (val, person) => {
     const formatted = formatDateInput(val);
     if (person === 'A') setRetDateA(formatted);
     else setRetDateB(formatted);
  };

  const handleExport = () => {
    const data = { 
      nameA, nameB, isMarried, targetIncomeToday, hasChurchTax, hasChildren, kvStatus, pkvPremium, 
      salaryInputMode, salaryInputValue, salaryMultiplier, besoldungLand, besoldungGruppe, besoldungStufe, wageGrowthRate, 
      birthDateA, retDateA, grvGrossA, pensionTypeA, pensionEndGruppeA, pensionEndStufeA, pensionSatzA,
      birthDateB, retDateB, grvGrossB, pensionTypeB, pensionEndGruppeB, pensionEndStufeB, pensionSatzB,
      grvIncreaseRate, inflationRate, taxIndexRate, solutionSavingsReturn, solutionSavingsDynamic, contracts, 
      planerCapital, planerDuration, planerReturn, planerDynamic, includePlanerInNet, tuevItems
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
        if (data.nameA !== undefined) setNameA(data.nameA);
        if (data.nameB !== undefined) setNameB(data.nameB);
        if (data.birthDateA) setBirthDateA(data.birthDateA);
        if (data.retDateA) setRetDateA(data.retDateA);
        if (data.birthDateB) setBirthDateB(data.birthDateB);
        if (data.retDateB) setRetDateB(data.retDateB);
        if (data.isMarried !== undefined) setIsMarried(data.isMarried);
        if (data.targetIncomeToday) setTargetIncomeToday(data.targetIncomeToday);
        if (data.hasChurchTax !== undefined) setHasChurchTax(data.hasChurchTax); 
        
        if (data.salaryInputMode) setSalaryInputMode(data.salaryInputMode);
        if (data.salaryInputValue) setSalaryInputValue(data.salaryInputValue);
        if (data.salaryMultiplier) setSalaryMultiplier(data.salaryMultiplier);
        if (data.besoldungLand) setBesoldungLand(data.besoldungLand);
        if (data.besoldungGruppe) setBesoldungGruppe(data.besoldungGruppe);
        if (data.besoldungStufe) setBesoldungStufe(data.besoldungStufe);

        if (data.wageGrowthRate !== undefined) setWageGrowthRate(data.wageGrowthRate);
        if (data.hasChildren !== undefined) setHasChildren(data.hasChildren);
        if (data.contracts) setContracts(data.contracts);
        
        if (data.pensionTypeA) setPensionTypeA(data.pensionTypeA);
        if (data.pensionEndGruppeA) setPensionEndGruppeA(data.pensionEndGruppeA);
        if (data.pensionEndStufeA) setPensionEndStufeA(data.pensionEndStufeA);
        if (data.pensionSatzA !== undefined) setPensionSatzA(data.pensionSatzA);
        if (data.grvGrossA !== undefined) setGrvGrossA(data.grvGrossA);
        
        if (data.pensionTypeB) setPensionTypeB(data.pensionTypeB);
        if (data.pensionEndGruppeB) setPensionEndGruppeB(data.pensionEndGruppeB);
        if (data.pensionEndStufeB) setPensionEndStufeB(data.pensionEndStufeB);
        if (data.pensionSatzB !== undefined) setPensionSatzB(data.pensionSatzB);
        if (data.grvGrossB !== undefined) setGrvGrossB(data.grvGrossB);

        if (data.grvIncreaseRate !== undefined) setGrvIncreaseRate(data.grvIncreaseRate);
        if (data.inflationRate) setInflationRate(data.inflationRate);
        if (data.taxIndexRate !== undefined) setTaxIndexRate(data.taxIndexRate); 
        if (data.solutionSavingsReturn !== undefined) setSolutionSavingsReturn(data.solutionSavingsReturn);
        if (data.solutionSavingsDynamic !== undefined) setSolutionSavingsDynamic(data.solutionSavingsDynamic);
        if (data.planerDuration !== undefined) setPlanerDuration(data.planerDuration);
        if (data.tuevItems !== undefined) setTuevItems(data.tuevItems);
        alert("Profil erfolgreich geladen!");
      } catch (err) { alert("Fehler beim Laden der Datei. Bitte prüfen Sie das Format."); }
    };
    reader.readAsText(file);
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
            if (newType === 'etf') { updates.capital = 0; updates.monthly = 100; updates.returnAcc = 6.0; updates.returnWith = 0.0; updates.ter = 0.2; updates.duration = 25; updates.specialPayment = 0; updates.specialPaymentYear = new Date().getFullYear() + 10; updates.payoutStrategy = 'planer'; }
            return { ...c, ...updates };
        }
        return c;
    }));
  };

  // --- ZENTRALE GEHALTS BERECHNUNG ---
  const currentFinancials = useMemo(() => {
    let annualGross = 0;
    let annualNet = 0;
    let avgMonthlyNet = 0;
    let avgMonthlyGross = 0;
    let zvEToday = 0;

    if (salaryInputMode === 'besoldung') {
        const monthlyGross = getBesoldung(besoldungGruppe, besoldungStufe, besoldungLand, isMarried, hasChildren);
        avgMonthlyGross = monthlyGross;
        annualGross = monthlyGross * 12;
        
        // Beamte: 0% RV/AV. KV/PV oft PKV oder freiwillig GKV
        let sv_kvpv = 0;
        if (kvStatus === 'pkv') sv_kvpv = (pkvPremium || 0) * 12;
        else if (kvStatus === 'freiwillig' || kvStatus === 'kvdr') {
             const BBG_KV = 5812.50 * 12;
             const kvpvRate = 0.146 + (hasChildren ? 0.034 : 0.04) + 0.016; // Voller Satz für Beamte in GKV (ohne Beihilfe-Tarif in GKV)
             sv_kvpv = Math.min(annualGross, BBG_KV) * kvpvRate;
        }
        const sv_rvav = 0; 
        
        const totalSv = sv_kvpv + sv_rvav;
        const werbungskosten = 1230; 
        zvEToday = Math.max(0, annualGross - werbungskosten - totalSv);
        
        const tax = calculateESt(zvEToday, isMarried);
        const kist = hasChurchTax ? tax * 0.08 : 0;
        
        annualNet = annualGross - totalSv - tax - kist;
        avgMonthlyNet = annualNet / 12;

    } else if (salaryInputMode === 'brutto') {
        annualGross = (salaryInputValue || 0) * (salaryMultiplier || 12);
        const BBG_KV = 5812.50 * 12; 
        const BBG_RV = 7550.00 * 12; 
        
        let sv_kvpv = 0;
        if (kvStatus === 'pkv') sv_kvpv = (pkvPremium || 0) * 12;
        else {
            const kvpvRate = 0.073 + (hasChildren ? 0.017 : 0.022) + 0.008; 
            sv_kvpv = Math.min(annualGross, BBG_KV) * kvpvRate;
        }
        const rvavRate = 0.093 + 0.013; 
        const sv_rvav = Math.min(annualGross, BBG_RV) * rvavRate;
        
        const totalSv = sv_kvpv + sv_rvav;
        const werbungskosten = 1230; 
        zvEToday = Math.max(0, annualGross - werbungskosten - totalSv);
        
        const tax = calculateESt(zvEToday, isMarried);
        const kist = hasChurchTax ? tax * 0.08 : 0;
        
        annualNet = annualGross - totalSv - tax - kist;
        avgMonthlyNet = annualNet / 12;
        avgMonthlyGross = annualGross / 12;
    } else {
        annualNet = (salaryInputValue || 0) * (salaryMultiplier || 12);
        avgMonthlyNet = annualNet / 12;
        avgMonthlyGross = isMarried ? avgMonthlyNet * 1.35 : avgMonthlyNet * 1.55;
        annualGross = avgMonthlyGross * 12;
        zvEToday = annualGross * 0.82; 
    }

    return { annualGross, annualNet, avgMonthlyNet, avgMonthlyGross, zvEToday };
  }, [salaryInputMode, salaryInputValue, salaryMultiplier, isMarried, hasChurchTax, hasChildren, kvStatus, pkvPremium, besoldungGruppe, besoldungStufe, besoldungLand]);

  // Dynamische Berechnung der Pensionen, falls 'pension' ausgewählt
  const computedPensionA = useMemo(() => {
     if (pensionTypeA !== 'pension') return grvGrossA;
     const finalGross = getBesoldung(pensionEndGruppeA, pensionEndStufeA, besoldungLand, isMarried, hasChildren);
     return finalGross * (pensionSatzA / 100);
  }, [pensionTypeA, grvGrossA, pensionEndGruppeA, pensionEndStufeA, besoldungLand, isMarried, hasChildren, pensionSatzA]);

  const computedPensionB = useMemo(() => {
     if (pensionTypeB !== 'pension') return grvGrossB;
     const finalGross = getBesoldung(pensionEndGruppeB, pensionEndStufeB, besoldungLand, isMarried, hasChildren);
     return finalGross * (pensionSatzB / 100);
  }, [pensionTypeB, grvGrossB, pensionEndGruppeB, pensionEndStufeB, besoldungLand, isMarried, hasChildren, pensionSatzB]);


  // --- BERECHNUNGSLOGIK (Engine) ---
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
    const projectedFinalNet = currentFinancials.avgMonthlyNet * Math.pow(1 + wageGrowthRate / 100, maxYearsToRet);
    
    const getYearFromStr = (str) => {
        const vals = parseDateValues(str);
        return vals ? vals.y : currentYear;
    };

    const retirementYearA = getYearFromStr(retDateA);
    const retirementYearB = getYearFromStr(retDateB);
    const baseRetYear = isMarried ? Math.max(retirementYearA, retirementYearB) : retirementYearA;

    const ertragsanteilRateA = getErtragsanteil(Math.floor(retirementAgeA));
    const ertragsanteilRateB = getErtragsanteil(Math.floor(retirementAgeB));
    
    // GRV / Pension Besteuerung
    const taxBasePercentA = Math.min(1.0, 0.84 + (Math.max(0, retirementYearA - 2026) * 0.005));
    const taxBasePercentB = Math.min(1.0, 0.84 + (Math.max(0, retirementYearB - 2026) * 0.005));
    
    const kistRate = hasChurchTax ? 0.08 : 0;
    const kvRateFull = 0.175; 
    const kvRateHalf = kvRateFull / 2; 
    const pvRateFull = hasChildren ? 0.036 : 0.042;
    
    const wageGrowthFactor = Math.pow(1 + taxIndexRate / 100, maxYearsToRet); 
    const bavFreibetragKV = 197.75 * wageGrowthFactor; 
    const BBG_KV = 5812.50 * wageGrowthFactor; 

    // Schicht 1 Basis-Werte
    const grvFutureGrossA_raw = computedPensionA * Math.pow(1 + grvIncreaseRate / 100, yearsToRetA);
    const grvFutureGrossA = grvFutureGrossA_raw * (1 - getGrvAbschlag(retirementAgeA));
    
    const grvFutureGrossB_raw = computedPensionB * Math.pow(1 + grvIncreaseRate / 100, yearsToRetB);
    const grvFutureGrossB = isMarried ? (grvFutureGrossB_raw * (1 - getGrvAbschlag(retirementAgeB))) : 0;

    const grvFutureGrossTotal = grvFutureGrossA + grvFutureGrossB;

    // Freibeträge berechnen (GRV = Kohorte, Pension = Versorgungsfreibetrag)
    let rentenFreibetragA = 0;
    if (pensionTypeA === 'pension') {
        const yearsAfter2023 = Math.max(0, retirementYearA - 2023);
        const vfbProzent = Math.max(0, 0.144 - (yearsAfter2023 * 0.004));
        const vfbMax = Math.max(0, 1080 - (yearsAfter2023 * 30));
        const vfbZuschlag = Math.max(0, 324 - (yearsAfter2023 * 9));
        const baseFreibetrag = Math.min(grvFutureGrossA * 12 * vfbProzent, vfbMax) + vfbZuschlag;
        rentenFreibetragA = baseFreibetrag / 12;
    } else {
        rentenFreibetragA = grvFutureGrossA * (1 - taxBasePercentA); 
    }

    let rentenFreibetragB = 0;
    if (pensionTypeB === 'pension') {
        const yearsAfter2023 = Math.max(0, retirementYearB - 2023);
        const vfbProzent = Math.max(0, 0.144 - (yearsAfter2023 * 0.004));
        const vfbMax = Math.max(0, 1080 - (yearsAfter2023 * 30));
        const vfbZuschlag = Math.max(0, 324 - (yearsAfter2023 * 9));
        const baseFreibetrag = Math.min(grvFutureGrossB * 12 * vfbProzent, vfbMax) + vfbZuschlag;
        rentenFreibetragB = baseFreibetrag / 12;
    } else {
        rentenFreibetragB = grvFutureGrossB * (1 - taxBasePercentB); 
    }

    let zvE_total = Math.max(0, grvFutureGrossA - rentenFreibetragA) + Math.max(0, grvFutureGrossB - rentenFreibetragB);

    let deductible_kvpv = 0;
    let grvKvpv = 0;
    let remainingBBG = isMarried ? BBG_KV * 2 : BBG_KV; 

    if (kvStatus === 'pkv') {
      // Beamten-Pension zahlt keinen KV-Zuschuss
      let grvSubsidy = 0;
      if (pensionTypeA === 'grv') grvSubsidy += Math.min(grvFutureGrossA, remainingBBG / (isMarried?2:1)) * kvRateHalf;
      if (pensionTypeB === 'grv' && isMarried) grvSubsidy += Math.min(grvFutureGrossB, remainingBBG / 2) * kvRateHalf;

      grvKvpv = Math.max(0, pkvPremium - grvSubsidy); 
      deductible_kvpv = pkvPremium * 0.8; 
    } else if (kvStatus === 'kvdr') {
      // KVdR Beitrag nur auf GRV, nicht auf Pension!
      let beitragspflichtig = 0;
      if (pensionTypeA === 'grv') beitragspflichtig += grvFutureGrossA;
      if (pensionTypeB === 'grv' && isMarried) beitragspflichtig += grvFutureGrossB;

      const grvBeitragspflichtig = Math.min(beitragspflichtig, remainingBBG);
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
      const cRetYear = c.owner === 'B' && isMarried ? retirementYearB : retirementYearA;
      const cErtRate = c.owner === 'B' && isMarried ? ertragsanteilRateB : ertragsanteilRateA;
      const cTaxBase = c.owner === 'B' && isMarried ? taxBasePercentB : taxBasePercentA;

      if (c.type === 'basis') {
        zvE_contribution = c.gross - (c.gross * (1 - cTaxBase)); 
        if (kvStatus === 'freiwillig') incomeForKV = Number(c.gross);
      } 
      else if (c.type === 'bav') {
        zvE_contribution = c.isOldContract ? Number(c.gross) * cErtRate : Number(c.gross); 
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
            if (r_w === 0) grossMonthly = cap / (duration * 12);
            else {
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
    let transferredCapital = 0;

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
        
        if (c.isOldContract) {
            tax = 0; kist = 0; c.appliedTaxMethod = 'Steuerfrei (Altvertrag)';
        } else {
            const taxFuenftel_today = (calculateESt(zvE_yearly_today + (c.gross / taxInflationFactor / 5), isMarried) - tax_today) * 5;
            const taxFuenftel = taxFuenftel_today * taxInflationFactor;
            const kistFuenftel = taxFuenftel * kistRate;
            tax = taxFuenftel; kist = kistFuenftel;
        }
        
        c.kvpv_deduction = monthlyKvPv * 120;
        c.netCapital = Math.max(0, c.gross - tax - kist - c.kvpv_deduction);
        
        if (strategy === 'planer') transferredCapital += c.netCapital;
        else if (strategy === 'rent') { net = (c.netCapital * ((c.withdrawalRate || 4) / 100)) / 12; s2_net += net; }
      }
      else if (c.type === 'prvKapital') {
        let totalPremiums = 0;
        const years = Math.max(0, c.cRetYear - (c.startYear || 2010));
        let currPremium = (c.monthlyPremium || 0) * 12;
        for (let i = 0; i < years; i++) { totalPremiums += currPremium; currPremium *= (1 + (c.dynamic || 0) / 100); }
        const profit = Math.max(0, c.gross - totalPremiums);
        
        if (c.isOldContract) {
            tax = 0; kist = 0; c.appliedTaxMethod = 'Steuerfrei (Altvertrag)';
        } else {
            const taxableProfit_today = (profit / taxInflationFactor) * 0.5 * 0.85; 
            const taxHalb_today = calculateESt(zvE_yearly_today + taxableProfit_today, isMarried) - tax_today;
            const taxHalb = Math.max(0, taxHalb_today * taxInflationFactor); 
            const kistHalb = taxHalb * kistRate;
            const abgeltungRate = hasChurchTax ? 0.278186 : 0.26375;
            const taxAbgeltung = profit * 0.85 * abgeltungRate; 
            
            if ((taxHalb + kistHalb) < taxAbgeltung) { tax = taxHalb; kist = kistHalb; c.appliedTaxMethod = 'Halbeinkünfte'; } 
            else { tax = taxAbgeltung; kist = 0; c.appliedTaxMethod = 'Abgeltungsteuer'; }
        }
        
        let monthlyKvPv = 0;
        if (kvStatus === 'freiwillig') {
           const anrechenbar = Math.min(profit / 120, Math.max(0, remainingBBG));
           monthlyKvPv = anrechenbar * (kvRateFull + pvRateFull);
           remainingBBG -= anrechenbar;
        }
        c.kvpv_deduction = monthlyKvPv * 120;
        c.netCapital = Math.max(0, c.gross - tax - kist - c.kvpv_deduction);
        
        if (strategy === 'planer') transferredCapital += c.netCapital;
        else if (strategy === 'rent') { net = (c.netCapital * ((c.withdrawalRate || 4) / 100)) / 12; s3_net += net; }
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
        
        const profitLump = Math.max(0, c.totalCap - totalInvested);
        const capTaxableBase = profitLump * 0.7; 
        let capTax = capTaxableBase * 0.25; 
        let capKist = hasChurchTax ? capTaxableBase * 0.08 : 0;
        capTax += capTax * 0.055; 
        c.netCapital = Math.max(0, c.totalCap - capTax - capKist);

        if (strategy === 'planer' || strategy === 'ignore') {
             tax = capTax; kist = capKist;
             if (strategy === 'planer') transferredCapital += c.netCapital;
        } else if (strategy === 'rent') {
             const totalPayout = c.grossMonthly * 12 * duration;
             const totalProfit = Math.max(0, totalPayout - totalInvested);
             const profitRatio = totalPayout > 0 ? (totalProfit / totalPayout) : 0;
             const taxableProfitPortion = c.grossMonthly * profitRatio;
             const taxableBase = taxableProfitPortion * 0.7; 
             tax = taxableBase * 0.25; 
             kist = hasChurchTax ? taxableBase * 0.08 : 0;
             tax += tax * 0.055;
             net = c.grossMonthly - c.kvpv_deduction - tax - kist;
             s3_net += net;
        }
      }

      return { ...c, net, tax, kist };
    });

    const effectivePlanerCapital = Number(planerCapital) + transferredCapital;
    let finalPlanerWithdrawalGross = 0, finalPlanerWithdrawalNet = 0, planerTax = 0, planerKist = 0;

    if (effectivePlanerCapital > 0 && planerDuration > 0) {
        const r_p = planerReturn / 100;
        const d_p = planerDynamic / 100;
        if (Math.abs(r_p - d_p) < 0.0001) finalPlanerWithdrawalGross = effectivePlanerCapital / (planerDuration * 12);
        else {
            const R = 1 + r_p, D = 1 + d_p;
            const W1_yearly = effectivePlanerCapital * ((R - D) / (1 - Math.pow(D/R, planerDuration)));
            finalPlanerWithdrawalGross = W1_yearly / 12;
        }

        let totalPayout = 0, currentW = finalPlanerWithdrawalGross * 12;
        for(let i=0; i<planerDuration; i++) { totalPayout += currentW; currentW *= (1 + d_p); }
        const totalProfit = Math.max(0, totalPayout - effectivePlanerCapital);
        const profitRatio = totalPayout > 0 ? (totalProfit / totalPayout) : 0;
        const taxablePortion = finalPlanerWithdrawalGross * profitRatio;
        
        let tax = taxablePortion * 0.25;
        let kist = hasChurchTax ? taxablePortion * 0.08 : 0;
        tax += tax * 0.055; 

        planerTax = tax; planerKist = kist;
        finalPlanerWithdrawalNet = finalPlanerWithdrawalGross - planerTax - planerKist;
    }

    if (includePlanerInNet) s3_net += finalPlanerWithdrawalNet;

    const gap = Math.max(0, targetIncomeFuture - (s1_net + s2_net + s3_net));

    const r_ret = (2.0 / 100) / 12;
    const n_ret = 25 * 12;
    let requiredCapital = gap > 0 ? (r_ret > 0 ? gap * (1 - Math.pow(1 + r_ret, -n_ret)) / r_ret : gap * n_ret) : 0;

    const dyn = solutionSavingsDynamic / 100;
    const netSolutionReturn = Math.max(0, solutionSavingsReturn);
    const r_m = (netSolutionReturn / 100) / 12;
    let requiredSavings = 0;
    if (requiredCapital > 0 && maxYearsToRet > 0) {
      if (r_m > 0) {
        if (dyn === 0) requiredSavings = requiredCapital * r_m / (Math.pow(1 + r_m, maxYearsToRet * 12) - 1);
        else {
          const r_a = Math.pow(1 + r_m, 12) - 1, C = (Math.pow(1 + r_m, 12) - 1) / r_m; 
          if (Math.abs(r_a - dyn) < 0.00001) requiredSavings = requiredCapital / (C * maxYearsToRet * Math.pow(1 + r_a, maxYearsToRet - 1));
          else requiredSavings = requiredCapital / (C * ((Math.pow(1 + r_a, maxYearsToRet) - Math.pow(1 + dyn, maxYearsToRet)) / (r_a - dyn)));
        }
      } else { 
        if (dyn === 0) requiredSavings = requiredCapital / (maxYearsToRet * 12);
        else requiredSavings = requiredCapital / (12 * ((Math.pow(1 + dyn, maxYearsToRet) - 1) / dyn));
      }
    }
    
    const lumpSumRequired = requiredCapital > 0 ? requiredCapital / Math.pow(1 + (netSolutionReturn/100), maxYearsToRet) : 0;

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
        const netSalary = currentFinancials.avgMonthlyNet * Math.pow(1 + wageGrowthRate / 100, yearsFromNow);
        incomeChartData.push({ age: ageA_in_y, year: y, isRetirement: false, totalNet: netSalary, target, discount, planer: 0 });
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
        incomeChartData.push({ age: ageA_in_y, year: y, isRetirement: true, totalNet, target, discount, planer: currentPlanerNet });
      }
    }

    return {
      currentAgeA, currentAgeB, retirementAgeA, retirementAgeB,
      ertragsanteilRateA, ertragsanteilRateB,
      yearsToRetA, yearsToRetB, maxYearsToRet, targetIncomeFuture, baseRetYear,
      inflationFactor, incomeChartData, zvE_yearly: zvE_yearly_nominal, avgTaxRate, marginalTaxRate: marginalTaxToday, deductible_kvpv, 
      grvFutureGrossTotal, grvNet, grvKvpv, grvESt, grvKist, s1_net, s2_net, s3_net, contracts: finalizedContracts,
      totalNetFuture: s1_net + s2_net + s3_net, gap, requiredCapital, requiredSavings, lumpSumRequired,
      grvDiscountA: getGrvAbschlag(retirementAgeA), grvDiscountB: getGrvAbschlag(retirementAgeB), projectedFinalNet,
      effectivePlanerCapital, finalPlanerWithdrawal: finalPlanerWithdrawalNet, finalPlanerWithdrawalGross, planerTax, planerKist, transferredCapital
    };
  }, [
    birthDateA, retDateA, computedPensionA, birthDateB, retDateB, computedPensionB, currentFinancials.avgMonthlyNet,
    targetIncomeToday, hasChildren, isMarried, kvStatus, pkvPremium, hasChurchTax, wageGrowthRate,
    grvIncreaseRate, contracts, planerCapital, planerDuration, planerReturn, planerDynamic, includePlanerInNet,
    inflationRate, taxIndexRate, solutionSavingsReturn, solutionSavingsDynamic, pensionTypeA, pensionTypeB
  ]);

  // --- TÜV BERECHNUNGSLOGIK ---
  const tuevData = useMemo(() => {
     const estimatedGross = currentFinancials.avgMonthlyGross;
     const zvEToday = currentFinancials.zvEToday; 
     
     const taxTodayYear = calculateESt(zvEToday, isMarried);
     let marginalTaxNow = (calculateESt(zvEToday + 100, isMarried) - taxTodayYear) / 100;
     marginalTaxNow *= (1 + (hasChurchTax ? 0.08 : 0));
     
     const BBG_KV_monthly = 5812.50; 
     const BBG_RV_monthly = 7550.00; 
     
     let svNow = 0;
     let svText = "";
     
     if (salaryInputMode === 'besoldung') {
         svNow = 0; 
         svText = "0 % (Beamte zahlen keine gesetzliche RV/AV)";
     } else if (kvStatus === 'pkv') {
         if (estimatedGross < BBG_RV_monthly) {
             svNow = 0.106; 
             svText = "10,6 % (Nur RV/AV, PKV-versichert)";
         } else {
             svNow = 0; svText = "0 % (Gehalt über BBG)";
         }
     } else {
         if (estimatedGross < BBG_KV_monthly) {
             svNow = 0.211; 
             svText = "21,1 % (Volle SV-Ersparnis)";
         } else if (estimatedGross < BBG_RV_monthly) {
             svNow = 0.106;
             svText = "10,6 % (Nur RV/AV, über KV-Grenze)";
         } else {
             svNow = 0; svText = "0 % (Gehalt über BBG)";
         }
     }

     const taxRetirement = calculations.marginalTaxRate;
     const currentYearNum = new Date().getFullYear();

     const evaluatedItems = tuevItems.map(item => {
         const selectedC = contracts.find(c => c.id === item.contractId);
         const calcC = calculations.contracts.find(c => c.id === item.contractId);
         
         if (!selectedC || !calcC) return { ...item, invalid: true };

         const cType = selectedC.type;
         const strategy = selectedC.payoutStrategy || (selectedC.includeInNet === false ? 'ignore' : 'rent');
         const isKapital = cType.includes('Kapital') || (cType === 'etf' && strategy !== 'rent');
         
         let payoutGross = 0;
         if (cType === 'etf') {
             payoutGross = strategy === 'rent' ? (calcC.grossMonthly || 0) : (calcC.totalCap || 0);
         } else {
             payoutGross = Number(selectedC.gross) || 0;
         }

         const cRetDate = selectedC.owner === 'B' && isMarried ? retDateB : retDateA;
         const cRetYear = parseDateValues(cRetDate)?.y || new Date().getFullYear();
         const cRetAge = selectedC.owner === 'B' && isMarried ? calculations.retirementAgeB : calculations.retirementAgeA;
         
         const safeStartDate = item.startDate || `01.01.${currentYearNum}`;
         const safeLifeExpectancy = item.lifeExpectancy || 85;
         
         const yearsAcc = Math.max(1, diffInYears(safeStartDate, cRetDate));
         const statutoryYears = Math.max(1, safeLifeExpectancy - cRetAge);

         let activeStatutoryYears = statutoryYears;
         if (cType === 'etf' && strategy === 'rent') activeStatutoryYears = selectedC.duration || 25;

         let agZuschuss = 0;
         let steuerErsparnis = 0;
         let svErsparnis = 0;
         let echterNettoAufwand = 0; 
         let summeNettoEinzahlung = 0;
         let yearlyNetFlows = [];

         let snapshotZulage = 0;
         let snapshotSteuerErsparnis = 0;

         let dynRate = 1 + (item.dynamic || 0) / 100;
         let currentGrossMonthly = item.grossMonthly;

         if (cType === 'riester') {
             for (let t = 1; t <= yearsAcc; t++) {
                 let y = currentYearNum + t - 1;
                 let childSub = 0;
                 (item.children || []).forEach(ch => {
                      let age = y - ch.birthYear;
                      if (age < 25) childSub += (ch.birthYear >= 2008 ? 300 : 185);
                 });
                 
                 let zulageJahr = item.subsidyRiester + childSub;
                 let maxAbsetzbar = Math.min(currentGrossMonthly * 12 + zulageJahr, 2100);
                 let steuerErsparnisJahr = Math.max(0, maxAbsetzbar * marginalTaxNow - zulageJahr);
                 
                 let netCostJahr = (currentGrossMonthly * 12) - steuerErsparnisJahr;
                 let valToSave = Math.max(0, netCostJahr);
                 
                 summeNettoEinzahlung += valToSave;
                 yearlyNetFlows.push(valToSave);

                 if (t === 1) { 
                     snapshotZulage = zulageJahr / 12;
                     snapshotSteuerErsparnis = steuerErsparnisJahr / 12;
                     echterNettoAufwand = valToSave / 12;
                 }
                 currentGrossMonthly *= dynRate;
             }
         } 
         else if (cType.includes('bav')) {
             for (let t = 1; t <= yearsAcc; t++) {
                 let ratio = item.grossMonthly > 0 ? (currentGrossMonthly / item.grossMonthly) : 1;
                 let currentAgZuschuss = Math.min(currentGrossMonthly, (item.subsidyBav || 0) * ratio);
                 
                 let anBrutto = currentGrossMonthly - currentAgZuschuss;
                 let currSvErsparnis = anBrutto * svNow;
                 let currSteuerErsparnis = Math.max(0, (anBrutto - currSvErsparnis) * marginalTaxNow);
                 let currNettoAufwand = Math.max(0, anBrutto - currSteuerErsparnis - currSvErsparnis);
                 
                 summeNettoEinzahlung += currNettoAufwand * 12;
                 yearlyNetFlows.push(currNettoAufwand * 12);
                 
                 if (t === 1) {
                     agZuschuss = currentAgZuschuss;
                     svErsparnis = currSvErsparnis;
                     steuerErsparnis = currSteuerErsparnis;
                     echterNettoAufwand = currNettoAufwand;
                 }
                 currentGrossMonthly *= dynRate;
             }
         } 
         else if (cType === 'basis') {
             for (let t = 1; t <= yearsAcc; t++) {
                 let currSteuerErsparnis = currentGrossMonthly * marginalTaxNow;
                 let currNettoAufwand = Math.max(0, currentGrossMonthly - currSteuerErsparnis);
                 
                 summeNettoEinzahlung += currNettoAufwand * 12;
                 yearlyNetFlows.push(currNettoAufwand * 12);

                 if (t === 1) {
                     steuerErsparnis = currSteuerErsparnis;
                     echterNettoAufwand = currNettoAufwand;
                 }
                 currentGrossMonthly *= dynRate;
             }
         } 
         else {
             if (cType === 'etf') {
                 const startCap = selectedC.capital || 0;
                 const specialPay = (selectedC.specialPaymentYear <= cRetYear) ? (selectedC.specialPayment || 0) : 0;
                 summeNettoEinzahlung = startCap + specialPay;
                 for (let t = 1; t <= yearsAcc; t++) {
                     let flow = currentGrossMonthly * 12;
                     if (selectedC.specialPayment > 0 && (currentYearNum + t - 1) === selectedC.specialPaymentYear) {
                         flow += selectedC.specialPayment;
                     }
                     summeNettoEinzahlung += currentGrossMonthly * 12;
                     yearlyNetFlows.push(flow);
                     
                     if (t === 1) echterNettoAufwand = currentGrossMonthly;
                     currentGrossMonthly *= dynRate;
                 }
             } else {
                 for (let t = 1; t <= yearsAcc; t++) {
                     summeNettoEinzahlung += currentGrossMonthly * 12;
                     yearlyNetFlows.push(currentGrossMonthly * 12);
                     
                     if (t === 1) echterNettoAufwand = currentGrossMonthly;
                     currentGrossMonthly *= dynRate;
                 }
             }
         }

         let kvPvAbzug = 0, steuerAbzug = 0, echteNettoRente = 0, echteNettoKapital = 0, summeNettoAuszahlung = 0;

         if (isKapital) {
             echteNettoKapital = calcC.netCapital || 0;
             kvPvAbzug = calcC.kvpv_deduction || 0;
             steuerAbzug = (calcC.tax || 0) + (calcC.kist || 0);
             summeNettoAuszahlung = echteNettoKapital;
         } else {
             kvPvAbzug = calcC.kvpv_deduction || 0;
             steuerAbzug = (calcC.tax || 0) + (calcC.kist || 0);
             echteNettoRente = calcC.net || 0;
             summeNettoAuszahlung = echteNettoRente * 12 * activeStatutoryYears;
         }

         const amortisationsJahre = summeNettoEinzahlung > 0 && summeNettoAuszahlung > 0 ? (isKapital ? 0 : (summeNettoEinzahlung / (echteNettoRente * 12))) : 0;
         const nettoHebel = summeNettoEinzahlung > 0 ? (summeNettoAuszahlung / summeNettoEinzahlung) : 0;
         const echterNettoGewinn = summeNettoAuszahlung - summeNettoEinzahlung;

         let irr = 0;
         if (summeNettoEinzahlung > 0 && summeNettoAuszahlung > 0 && payoutGross > 0) {
             let minRate = -0.1, maxRate = 0.2;
             for (let i = 0; i < 40; i++) {
                 irr = (minRate + maxRate) / 2;
                 let npv = 0;
                 if (cType === 'etf') npv -= (selectedC.capital || 0);

                 for (let t = 1; t <= yearsAcc; t++) if (t - 1 < yearlyNetFlows.length) npv -= yearlyNetFlows[t-1] / Math.pow(1 + irr, t);
                 
                 if (isKapital) npv += summeNettoAuszahlung / Math.pow(1 + irr, yearsAcc);
                 else for (let t = yearsAcc + 1; t <= yearsAcc + activeStatutoryYears; t++) npv += (echteNettoRente * 12) / Math.pow(1 + irr, t);
                 
                 if (npv > 0) minRate = irr; else maxRate = irr;
             }
         }

         return {
             ...item, cType, payoutGross, isKapital, name: selectedC.name, layer: selectedC.layer,
             yearsAcc, statutoryYears: activeStatutoryYears, safeStartDate, safeLifeExpectancy,
             agZuschuss, snapshotZulage, snapshotSteuerErsparnis, steuerErsparnis, svErsparnis, echterNettoAufwand, summeNettoEinzahlung,
             kvPvAbzug, steuerAbzug, echteNettoRente, echteNettoKapital, summeNettoAuszahlung,
             amortisationsJahre, nettoHebel, irr: irr * 100, echterNettoGewinn
         };
     });

     return { marginalTaxNow, svNow, taxRetirement, estimatedGross, svText, items: evaluatedItems };
  }, [tuevItems, contracts, currentFinancials, isMarried, calculations, kvStatus, hasChildren, hasChurchTax, salaryInputMode]);

  // SVG Helper
  const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(val);
  const formatResultCurrency = (val) => formatCurrency(showRealValue ? val / calculations.inflationFactor : val);
  const formatChartCurrency = (val, discount) => formatCurrency(showRealValue ? val / discount : val);
  const formatYAxis = (val) => val >= 1000000 ? (val / 1000000).toFixed(1).replace('.0', '') + ' Mio.' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toString();
  const renderBonVal = (val) => (<><span className="print:hidden">{formatResultCurrency(val)}</span><span className="hidden print:inline">{formatCurrency(val)} <span className="text-slate-500 font-normal">({formatCurrency(val / calculations.inflationFactor)} real)</span></span></>);

  const renderSalaryInput = (context = 'top') => {
      const isTuev = context === 'tuev';
      return (
          <div className={isTuev ? "bg-white p-4 rounded-xl shadow-sm border border-slate-200" : "mb-5"}>
              <h3 className={`font-bold mb-3 ${isTuev ? 'text-sm text-slate-700 border-b border-slate-200 pb-2 flex items-center gap-2' : 'text-xs text-slate-600'}`}>
                  {isTuev && <Wallet className="w-4 h-4 text-slate-400"/>} 
                  {isTuev ? 'Ihr Einkommen (Ausgangsbasis)' : 'Heutiges Einkommen (Ausgangsbasis)'}
              </h3>
              
              <div className={`flex ${isTuev ? 'flex-col sm:flex-row gap-3 items-end' : 'flex-col gap-3 mb-1.5'}`}>
                  <div className="flex gap-2 w-full">
                      <div className="w-1/3">
                          {isTuev && <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gehalts-Art</label>}
                          <select value={salaryInputMode} onChange={e => setSalaryInputMode(e.target.value)} className={`w-full border rounded-lg p-2.5 text-sm font-bold outline-none shadow-sm ${isTuev ? 'border-amber-200 bg-amber-50 text-amber-900 focus:border-amber-400' : 'border-indigo-200 bg-white text-slate-700 focus:border-indigo-400'}`}>
                              <option value="brutto">Angestellt (Brutto)</option>
                              <option value="netto">Angestellt (Netto)</option>
                              <option value="besoldung">Beamter (Besoldung)</option>
                          </select>
                      </div>
                      
                      {salaryInputMode !== 'besoldung' ? (
                          <>
                              <div className="w-1/3">
                                  {isTuev && <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Betrag</label>}
                                  <input type="number" value={salaryInputValue} onChange={e => setSalaryInputValue(parseNum(e.target.value))} placeholder="Mtl. Betrag" className={`w-full border rounded-lg p-2.5 text-sm font-bold shadow-sm outline-none ${isTuev ? 'border-amber-200 bg-white focus:border-amber-400' : 'border-indigo-200 bg-white focus:border-indigo-400'}`} />
                              </div>
                              <div className="w-1/3">
                                  {isTuev && <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Auszahlungen / Jahr</label>}
                                  <select value={salaryMultiplier} onChange={e => setSalaryMultiplier(Number(e.target.value))} className={`w-full border rounded-lg p-2.5 text-sm font-bold outline-none shadow-sm ${isTuev ? 'border-amber-200 bg-white text-slate-700 focus:border-amber-400' : 'border-indigo-200 bg-white text-slate-700 focus:border-indigo-400'}`}>
                                      <option value={12}>12 Gehälter</option>
                                      <option value={12.5}>12.5 (halbes 13.)</option>
                                      <option value={13}>13 (+ Urlaubsgeld)</option>
                                      <option value={14}>14 (+ Urlaub/Weihn.)</option>
                                  </select>
                              </div>
                          </>
                      ) : (
                          <>
                              <div className="w-1/3">
                                  {isTuev && <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Besoldungsgruppe</label>}
                                  <select value={besoldungGruppe} onChange={e => setBesoldungGruppe(e.target.value)} className={`w-full border rounded-lg p-2.5 text-sm font-bold shadow-sm outline-none ${isTuev ? 'border-amber-200 bg-white focus:border-amber-400' : 'border-indigo-200 bg-white focus:border-indigo-400'}`}>
                                      {besoldungsgruppen.map(g => <option key={g} value={g}>{g}</option>)}
                                  </select>
                              </div>
                              <div className="w-1/3">
                                  {isTuev && <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Erfahrungsstufe</label>}
                                  <select value={besoldungStufe} onChange={e => setBesoldungStufe(Number(e.target.value))} className={`w-full border rounded-lg p-2.5 text-sm font-bold shadow-sm outline-none ${isTuev ? 'border-amber-200 bg-white focus:border-amber-400' : 'border-indigo-200 bg-white focus:border-indigo-400'}`}>
                                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Stufe {s}</option>)}
                                  </select>
                              </div>
                          </>
                      )}
                  </div>
                  
                  {salaryInputMode === 'besoldung' && (
                      <div className="w-full">
                          {isTuev && <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dienstherr / Bundesland</label>}
                          <select value={besoldungLand} onChange={e => setBesoldungLand(e.target.value)} className={`w-full border rounded-lg p-2.5 text-sm font-bold shadow-sm outline-none ${isTuev ? 'border-amber-200 bg-white focus:border-amber-400' : 'border-indigo-200 bg-white focus:border-indigo-400'}`}>
                              {Object.keys(besoldungsLaender).map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                      </div>
                  )}
              </div>
              
              <div className={`flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg p-3 mt-3 ${isTuev ? 'shadow-sm' : ''}`}>
                  <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Basis Ø Brutto</span>
                      <span className="font-bold text-slate-700">{formatCurrency(currentFinancials.avgMonthlyGross)}</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Jahresbrutto</span>
                      <span className="font-black text-slate-800">{formatCurrency(currentFinancials.annualGross)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                      <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Basis Ø Netto</span>
                      <span className="font-bold text-indigo-600">{formatCurrency(currentFinancials.avgMonthlyNet)}</span>
                  </div>
              </div>
              {salaryInputMode === 'besoldung' && (
                  <div className="text-[9px] text-slate-400 mt-2 flex items-center gap-1"><Info className="w-3 h-3"/> Basis: Richtwerte Bund/Länder (inkl. pauschalem Familienzuschlag falls ausgewählt). Ohne SV-Abzug (RV/AV).</div>
              )}
          </div>
      );
  };

  const chartWindowSize = 30; 
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

  const renderContractInput = (c) => {
    const calcC = calculations.contracts.find(x => x.id === c.id) || c;
    const isExpanded = c.isExpanded !== false;
    
    const typeLabels = {
      'basis': 'Rürup / Basisrente', 'bav': 'bAV (Rente)', 'bavKapital': 'bAV (Kapital)', 'riester': 'Riester-Rente',
      'prvRente': 'Private Rente (monatlich)', 'prvKapital': 'Private Rente (Kapitalauszahlung)',
      'immobilie': 'Vermietung (Immobilie)', 'etf': 'Freies Depot (ETF / Aktien)'
    };

    return (
    <div key={c.id} className="bg-white border border-slate-200 rounded-lg shadow-sm mb-3 print:border-slate-300 print:shadow-none overflow-hidden">
      <div 
        className={`flex justify-between items-center p-3 cursor-pointer hover:bg-slate-50 transition-colors print:hidden ${isExpanded ? 'border-b border-slate-100 bg-slate-50/50' : ''}`}
        onClick={() => updateContract(c.id, 'isExpanded', !isExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-white border border-slate-200 shadow-sm p-1 rounded text-slate-500">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wide">{typeLabels[c.type] || c.type}</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">{c.name || 'Neuer Vertrag'}</span>
            {isMarried && <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-1 font-bold uppercase tracking-wider">{c.owner === 'A' ? (nameA || 'Person A') : (nameB || 'Person B')}</span>}
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); removeContract(c.id); }} className="text-slate-300 hover:text-rose-500 p-1.5 transition-colors rounded-md hover:bg-rose-50" title="Vertrag löschen">
          <Trash className="w-4 h-4" />
        </button>
      </div>

      <div className={`${isExpanded ? 'block' : 'hidden'} print:block p-4 relative`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
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
             <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer"><input type="radio" checked={c.owner !== 'B'} onChange={() => updateContract(c.id, 'owner', 'A')} /> {nameA || 'Person A'}</label>
             <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer"><input type="radio" checked={c.owner === 'B'} onChange={() => updateContract(c.id, 'owner', 'B')} /> {nameB || 'Person B'}</label>
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
            <div className="bg-blue-50/50 rounded-lg border border-blue-100 overflow-hidden print:bg-white print:border-slate-200">
               <button onClick={() => updateContract(c.id, 'showSpecialPayment', !c.showSpecialPayment)} className="w-full p-2 flex justify-between items-center hover:bg-blue-100/50 transition-colors">
                   <div className="text-[10px] font-bold text-blue-800 flex items-center gap-1.5"><Zap className="w-3 h-3"/> Geplante Sonderzahlung {c.specialPayment > 0 && !c.showSpecialPayment && <span className="bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider ml-1">Aktiv ({formatCurrency(c.specialPayment)})</span>}</div>
                   {c.showSpecialPayment ? <ChevronUp className="w-3.5 h-3.5 text-blue-500" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-500" />}
               </button>
               {c.showSpecialPayment && (
                   <div className="p-2 pt-1 grid grid-cols-2 gap-3 border-t border-blue-100/50 print:border-slate-200">
                     <div><label className="block text-[9px] text-slate-500 mb-1">Summe (€)</label><input type="number" value={c.specialPayment ?? ''} onChange={e => updateContract(c.id, 'specialPayment', parseNum(e.target.value))} className="w-full border border-blue-200 bg-white rounded p-1.5 text-xs print:border-slate-300" placeholder="z.B. Erbe"/></div>
                     <div><label className="block text-[9px] text-slate-500 mb-1">Im Jahr</label><input type="number" value={c.specialPaymentYear ?? ''} onChange={e => updateContract(c.id, 'specialPaymentYear', parseNum(e.target.value))} className="w-full border border-blue-200 bg-white rounded p-1.5 text-xs print:border-slate-300" /></div>
                   </div>
               )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Rend. Ansp.</label><input type="number" step="0.1" value={c.returnAcc ?? 6} onChange={e => updateContract(c.id, 'returnAcc', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">Rend. Entn.</label><input type="number" step="0.1" value={c.returnWith ?? 2} onChange={e => updateContract(c.id, 'returnWith', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
              <div><label className="block text-[10px] font-semibold text-slate-500 mb-1">TER (%)</label><input type="number" step="0.1" value={c.ter ?? 0.2} onChange={e => updateContract(c.id, 'ter', parseNum(e.target.value))} className="w-full border border-slate-200 rounded p-1.5 text-xs" /></div>
              <div><label className="block text-[10px] font-bold text-indigo-600 mb-1">Dauer Entn.</label><input type="number" step="1" value={c.duration ?? 25} onChange={e => updateContract(c.id, 'duration', parseNum(e.target.value))} className="w-full border-2 border-indigo-300 rounded p-1.5 text-xs font-bold" /></div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <label className="block text-[10px] font-semibold text-slate-500 mb-2 uppercase">Auszahlungs-Strategie</label>
              <select value={c.payoutStrategy || (c.includeInNet === false ? 'ignore' : 'rent')} onChange={e => updateContract(c.id, 'payoutStrategy', e.target.value)} className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white font-medium text-slate-700">
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
              <select value={c.payoutStrategy || (c.includeInNet === false ? 'ignore' : 'rent')} onChange={e => updateContract(c.id, 'payoutStrategy', e.target.value)} className="w-full border border-slate-200 rounded p-1.5 text-xs bg-white font-medium text-slate-700">
                 <option value="rent">In mtl. Rente umwandeln (ins Netto)</option>
                 <option value="planer">Netto-Kapital in den Planer übertragen</option>
                 <option value="ignore">Ignorieren (Nur Netto-Kapital anzeigen)</option>
              </select>
            </div>
          </div>
        )}

        {(c.type === 'bav' || c.type === 'bavKapital' || c.type === 'prvRente' || c.type === 'prvKapital') && (
          <div className="mt-4 pt-3 border-t border-slate-100">
             <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={!!c.isOldContract} onChange={e => updateContract(c.id, 'isOldContract', e.target.checked)} className="rounded text-indigo-600 w-3 h-3 cursor-pointer" id={`old-${c.id}`} />
                <label htmlFor={`old-${c.id}`} className="text-[10px] text-slate-600 font-medium cursor-pointer">Vertrag vor 2005 abgeschlossen (Steuerprivileg)</label>
             </div>
             <div className="flex items-center gap-2 mb-3">
                <input type="checkbox" checked={!!c.compareMode} onChange={e => updateContract(c.id, 'compareMode', e.target.checked)} className="rounded text-emerald-600 w-3 h-3 cursor-pointer" id={`comp-${c.id}`} />
                <label htmlFor={`comp-${c.id}`} className="text-[10px] text-slate-700 font-bold cursor-pointer">Wahlrecht simulieren (Vergleich: Rente vs. Kapital)</label>
             </div>

             {c.compareMode && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-2">
                   <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-slate-500 uppercase font-bold mb-1.5">Brutto-Rente mtl. (€)</label>
                        <input type="number" value={c.compareRenteGross ?? ''} onChange={e => updateContract(c.id, 'compareRenteGross', parseNum(e.target.value))} className="w-full border border-slate-300 bg-white rounded-lg p-2.5 text-sm font-semibold" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 uppercase font-bold mb-1.5">Brutto-Kapital (€)</label>
                        <input type="number" value={c.compareCapitalGross ?? ''} onChange={e => updateContract(c.id, 'compareCapitalGross', parseNum(e.target.value))} className="w-full border border-slate-300 bg-white rounded-lg p-2.5 text-sm font-semibold" />
                      </div>
                   </div>

                   {calcC.compareResult && (
                      <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm mt-2">
                         <div className="grid grid-cols-2 gap-4 pb-4 mb-4 border-b border-slate-100">
                            <div><div className="text-xs text-slate-500 font-bold uppercase mb-1">Netto-Kapital</div><div className="font-black text-lg text-emerald-600">{formatCurrency(calcC.compareResult.netCapital)}</div></div>
                            <div><div className="text-xs text-slate-500 font-bold uppercase mb-1">Netto-Rente</div><div className="font-black text-lg text-indigo-600">{formatCurrency(calcC.compareResult.netRente)} / M</div></div>
                         </div>
                         <div className="space-y-3">
                            <div className="bg-slate-50 p-3.5 rounded-xl flex gap-3 items-start"><Calculator className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" /><div className="text-xs text-slate-700 leading-relaxed"><span className="font-bold text-slate-900">1. Break-Even (0 % Zins):</span> Sie müssen <strong className="text-rose-600">{calcC.compareResult.breakEvenAge0.toFixed(1)} Jahre</strong> alt werden, damit Rente &gt; Kapital.</div></div>
                            <div className="bg-indigo-50/50 p-3.5 rounded-xl flex gap-3 items-start border border-indigo-50"><TrendingUp className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" /><div className="text-xs text-indigo-900 leading-relaxed"><span className="font-bold">2. Break-Even (2 % Anlage-Rendite):</span> {calcC.compareResult.isPerpetual ? " Das Kapital reicht ewig! Die Rente rechnet sich finanziell nie." : <> Sie müssen <strong className="text-rose-600">{calcC.compareResult.breakEvenAge2.toFixed(1)} Jahre</strong> alt werden.</>}</div></div>
                         </div>
                      </div>
                   )}
                </div>
             )}
          </div>
        )}
      </div>
    </div>
    );
  };

  const renderBonContract = (c) => {
    const strategy = c.payoutStrategy || (c.includeInNet === false ? 'ignore' : 'rent');
    const isKapital = c.type === 'etf' || c.type.includes('Kapital');
    const bruttoKapital = Number(c.type === 'etf' ? c.totalCap : c.gross) || 0;
    const nettoKapital = Number(c.netCapital) || 0;
    const safeBrutto = isNaN(bruttoKapital) ? 0 : bruttoKapital;
    const safeNetto = isNaN(nettoKapital) ? 0 : nettoKapital;

    let subtitle = '';
    if (isKapital) {
       if (strategy === 'rent') subtitle = `Brutto: ${formatResultCurrency(safeBrutto)} (Netto: ${formatResultCurrency(safeNetto)}) | Mtl. Entnahme`;
       else subtitle = `Kapital: ${formatResultCurrency(safeBrutto)} | ${strategy === 'planer' ? 'In Planer übertragen' : 'Ignoriert'}`;
    } else {
       const ertragsanteilText = (c.type === 'prvRente' || (c.type === 'bav' && c.isOldContract)) ? ` | Steuerpflichtig: ${Math.round((c.owner === 'B' && isMarried ? calculations.ertragsanteilRateB : calculations.ertragsanteilRateA) * 100)} %` : '';
       subtitle = `Brutto: ${formatResultCurrency(Number(c.gross) || 0)}${ertragsanteilText}`;
    }
    const altvertragBadge = c.isOldContract ? <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded ml-2 uppercase font-bold tracking-wider">Altvertrag</span> : null;

    return (
      <div key={c.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2 break-inside-avoid">
        <div className="flex justify-between items-center mb-1">
          <div className="font-semibold text-sm text-blue-900">{c.name} {isMarried ? `(${c.owner === 'A' ? (nameA || 'Person A') : (nameB || 'Person B')})` : ''} {altvertragBadge}</div>
          <div className={`font-bold text-base ${strategy !== 'rent' ? 'text-slate-400' : 'text-slate-800'}`}>{strategy !== 'rent' ? '0 €' : renderBonVal(c.net || 0)}</div>
        </div>
        <div className="flex justify-between items-end text-[10px] text-slate-500">
          <div>{subtitle}</div>
          {(c.kvpv_deduction > 0 || (c.tax || 0) > 0 || (c.kist || 0) > 0) && (
            <div className="text-rose-500 text-right leading-tight">
              {c.kvpv_deduction > 0 ? `KV/PV: ${formatResultCurrency(c.kvpv_deduction)} | ` : ''}{c.type === 'etf' ? 'Abgeltung: ' : 'ESt: '}{formatResultCurrency((c.tax || 0) + (c.kist || 0))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-28 print:bg-slate-50 print:pb-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      
      <header className={`sticky top-0 z-50 bg-slate-900 text-white shadow-md print:hidden transition-all duration-300 ease-in-out ${isHeaderCollapsed ? 'py-2' : 'p-3 sm:p-4'}`}>
        <div className="max-w-6xl mx-auto relative flex items-center justify-center min-h-[40px]">
          
          <button onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)} className="absolute right-0 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full transition-colors focus:outline-none z-10 shadow-sm border border-slate-700 mr-2 sm:mr-4" title={isHeaderCollapsed ? "Menü ausklappen" : "Menü einklappen"}>
            {isHeaderCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          <div className={`w-full flex transition-all duration-300 ${isHeaderCollapsed ? 'justify-center' : 'flex-col lg:flex-row items-center gap-4 pr-10 lg:pr-0'}`}>
            
            {isHeaderCollapsed ? (
              <div className="flex items-center justify-center cursor-pointer group" onClick={() => setIsHeaderCollapsed(false)} title="Klicken zum Ausklappen">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 transform group-hover:scale-110 transition-transform duration-200">
                  <rect x="15" y="60" width="16" height="25" rx="4" fill="#94A3B8" />
                  <rect x="42" y="40" width="16" height="45" rx="4" fill="#64748B" />
                  <rect x="69" y="20" width="16" height="65" rx="4" fill="#1E40AF" />
                  <path d="M10 50 L40 30 L60 40 L85 10" stroke="#10B981" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="85" cy="10" r="8" fill="#10B981" />
                </svg>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-4 sm:gap-6 w-full lg:w-1/2 shrink-0">
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 sm:w-20 sm:h-20 shrink-0">
                    <rect x="15" y="60" width="16" height="25" rx="4" fill="#94A3B8" />
                    <rect x="42" y="40" width="16" height="45" rx="4" fill="#64748B" />
                    <rect x="69" y="20" width="16" height="65" rx="4" fill="#1E40AF" />
                    <path d="M10 50 L40 30 L60 40 L85 10" stroke="#10B981" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="85" cy="10" r="8" fill="#10B981" />
                  </svg>
                  <div className="text-left">
                    <h1 className="text-xl sm:text-3xl font-extrabold leading-tight tracking-tight">JS-Rentenplaner </h1>
                    <p className="text-slate-400 text-xs sm:text-base font-medium mt-0.5">Ihre Zukunft. Heute smart geplant.</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 items-center lg:items-end w-full lg:w-1/2">
                  <div className="flex bg-slate-800 p-1.5 rounded-lg border border-slate-700 gap-1.5 flex-wrap justify-center lg:justify-end">
                    <button onClick={() => setShowRealValue(!showRealValue)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${showRealValue ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Coins className="w-3 h-3" /> Kaufkraft heute</button>
                    <div className="w-px bg-slate-700 mx-1"></div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white shadow">
                      <span>Infl.:</span><select value={inflationRate} onChange={e => setInflationRate(Number(e.target.value))} className="bg-transparent font-bold outline-none cursor-pointer"><option value={0}>0 %</option><option value={1.5}>1,5 %</option><option value={2.0}>2,0 %</option><option value={2.5}>2,5 %</option></select>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white shadow">
                      <span>Index.:</span>
                      <select value={taxIndexRate} onChange={e => setTaxIndexRate(Number(e.target.value))} className="bg-transparent font-bold outline-none cursor-pointer">
                        <option value={0}>0 %</option><option value={1.0}>1,0 %</option><option value={1.5}>1,5 %</option><option value={2.0}>2,0 %</option>
                        {taxIndexRate !== '' && ![0, 1.0, 1.5, 2.0].includes(taxIndexRate) && <option value={taxIndexRate}>{taxIndexRate} %</option>}
                      </select>
                    </div>
                    <div className="w-px bg-slate-700 mx-1"></div>
                    <button onClick={() => setIsMarried(false)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!isMarried ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}><User className="w-3 h-3" /> Single</button>
                    <button onClick={() => setIsMarried(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isMarried ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}><Users className="w-3 h-3" /> Verheiratet</button>
                  </div>

                  <div className="flex bg-slate-800 p-1.5 rounded-lg border border-slate-700 gap-1.5 flex-wrap justify-center lg:justify-end">
                    <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
                    <button onClick={() => fileInputRef.current.click()} title="Profil laden" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"><FolderOpen className="w-3.5 h-3.5" /> Laden</button>
                    <button onClick={handleExport} title="Profil speichern" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"><Save className="w-3.5 h-3.5" /> Speichern</button>
                    <div className="w-px bg-slate-700 mx-1"></div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium bg-slate-800 border border-slate-700 text-white">
                      <span className="text-slate-400 hidden sm:inline">PDF-Text:</span>
                      <select value={printExplanationMode} onChange={e => setPrintExplanationMode(e.target.value)} className="bg-transparent font-bold outline-none cursor-pointer"><option value="none" className="text-slate-800">Ohne</option><option value="short" className="text-slate-800">Kurz</option><option value="long" className="text-slate-800">Ausführlich</option></select>
                    </div>
                    <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 shadow-sm ml-1 transition-colors"><Download className="w-3 h-3" /> PDF Export</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* PREMIUM PRINT HEADER */}
      <div className="hidden print:flex max-w-6xl mx-auto p-8 border-b-4 border-emerald-500 mb-8 items-center justify-between bg-white shadow-sm rounded-t-2xl mt-4">
        <div className="flex items-center gap-6">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 shrink-0">
            <rect x="15" y="60" width="16" height="25" rx="4" fill="#94A3B8" />
            <rect x="42" y="40" width="16" height="45" rx="4" fill="#64748B" />
            <rect x="69" y="20" width="16" height="65" rx="4" fill="#1E40AF" />
            <path d="M10 50 L40 30 L60 40 L85 10" stroke="#10B981" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="85" cy="10" r="8" fill="#10B981" />
          </svg>
          <div className="text-left"><h2 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-1">JS-Rentenplaner </h2><p className="text-slate-500 text-xl font-medium">Ihre Zukunft. Heute smart geplant.</p></div>
        </div>
        <div className="text-right">
          <div className="inline-block bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Auswertung für</p>
            <p className="text-lg font-black text-slate-800">{isMarried ? `${nameA || 'Person A'} & ${nameB || 'Person B'} (Haushalt)` : (nameA || 'Person A')}</p>
            <p className="text-xs text-slate-500 mt-2 border-t border-slate-200 pt-2 font-medium flex justify-between gap-4"><span>Datum:</span> <span className="font-bold text-slate-700">{new Date().toLocaleDateString('de-DE')}</span></p>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 print:px-6 print:py-0 print:block">
        
        {/* PRINT ONLY: ZUSAMMENFASSUNG */}
        <div className="hidden print:block mb-8 print:break-after-page">
           <h2 className="text-xl font-bold uppercase tracking-widest border-b-2 border-slate-200 pb-2 mb-6 text-slate-800">1. Ihre Eingabedaten & Prämissen</h2>
           <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6">
              <div className="grid grid-cols-3 gap-y-6 gap-x-8 text-sm">
                 <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Alter heute</span> <span className="font-bold text-lg text-slate-800">{Math.floor(calculations.currentAgeA)} Jahre {isMarried ? <span className="text-slate-400 text-sm font-normal">/ {Math.floor(calculations.currentAgeB)} J.</span> : ''}</span></div>
                 <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Renteneintritt</span> <span className="font-bold text-lg text-slate-800">{Math.floor(calculations.retirementAgeA)} Jahre <span className="text-slate-400 text-sm font-normal">({calculations.baseRetYear})</span></span></div>
                 <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider mb-1">Zielbedarf (Netto)</span> <span className="font-black text-xl text-indigo-600">{formatCurrency(targetIncomeToday)} <span className="text-xs font-normal text-slate-500">Kaufkraft heute</span></span></div>
                 <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Steuer-Status</span> <span className="font-bold text-base text-slate-800">{isMarried ? 'Splittingtarif (Verheiratet)' : 'Grundtarif (Single)'}</span></div>
                 <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">KV-Status im Alter</span> <span className="font-bold text-base text-slate-800">{kvStatus === 'kvdr' ? 'KVdR (Pflichtversichert)' : kvStatus === 'pkv' ? 'Privat versichert (PKV)' : 'Freiwillig gesetzlich'}</span></div>
                 <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Inflation / Tarif-Index.</span> <span className="font-bold text-base text-slate-800">{inflationRate.toLocaleString("de-DE")} % p.a. <span className="text-slate-400 font-normal">/ {taxIndexRate.toLocaleString("de-DE")} % p.a.</span></span></div>
              </div>
           </div>

           <div className="mb-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Gesetzliche Basis (Schicht 1)</h3>
              <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                 <span className="font-semibold text-slate-700">Brutto-Anspruch heute</span>
                 <span className="text-xl font-black text-blue-700">{formatCurrency(grvGrossA)} <span className="text-sm font-bold text-blue-500">/ M</span> {isMarried && grvGrossB > 0 ? <span className="text-slate-500 text-sm font-semibold"> & {formatCurrency(grvGrossB)} / M</span> : ''}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-2 text-right uppercase tracking-wider font-bold">Angenommene Rentendynamik: {grvIncreaseRate}% p.a.</div>
           </div>

           {contracts.length > 0 && (
             <div className="bg-white border border-slate-200 rounded-xl p-0 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200"><h3 className="font-bold text-slate-800">Ihre Zusatz-Verträge & Depots</h3></div>
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-200">
                      <th className="p-4 font-bold w-24">Schicht</th><th className="p-4 font-bold w-40">Art</th><th className="p-4 font-bold">Name / Inhaber</th><th className="p-4 font-bold text-right">Wert / Beitrag</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800">
                     {contracts.map(c => (
                        <tr key={c.id} className="border-b border-slate-100 last:border-0">
                           <td className="p-4"><span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${c.layer === 1 ? 'bg-blue-100 text-blue-700' : c.layer === 2 ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>Schicht {c.layer}</span></td>
                           <td className="p-4 uppercase text-[11px] font-bold text-slate-500">{c.type.replace('prvKapital', 'Privat (Kapital)').replace('prvRente', 'Privat (Rente)').replace('bavKapital', 'bAV (Kapital)')}</td>
                           <td className="p-4 font-bold text-slate-700">{c.name} {isMarried ? <span className="text-slate-400 font-normal">({c.owner === 'A' ? (nameA || 'Person A') : (nameB || 'Person B')})</span> : ''}</td>
                           <td className="p-4 text-sm font-black text-right text-slate-800">{c.type === 'etf' ? `${formatCurrency(c.capital)}` : c.type.includes('Kapital') ? `${formatCurrency(c.gross)}` : c.type === 'immobilie' ? `${formatCurrency(c.gross)} / M` : `${formatCurrency(c.gross)} / M`}</td>
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
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2 print:border-indigo-200">
              <h2 className="text-sm font-bold text-slate-700 print:text-lg print:text-indigo-900">Allgemeine Daten & Ziel</h2>
              <div className="flex items-center gap-2 print:hidden">
                <label className="text-[10px] text-slate-400 font-bold uppercase hidden sm:block">Name:</label>
                <input type="text" value={personTab === 'A' ? nameA : nameB} onChange={e => personTab === 'A' ? setNameA(e.target.value) : setNameB(e.target.value)} placeholder={personTab === 'A' ? 'Person A' : 'Person B'} className="w-28 sm:w-36 border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none transition-colors" />
              </div>
            </div>
            
            {isMarried && (
              <div className="flex bg-slate-100 p-1 rounded-lg mb-4 print:hidden">
                 <button onClick={()=>setPersonTab('A')} className={`flex-1 py-1.5 text-xs font-bold rounded truncate px-2 ${personTab==='A' ? 'bg-white shadow text-indigo-700':'text-slate-500'}`}>{nameA || 'Person A'}</button>
                 <button onClick={()=>setPersonTab('B')} className={`flex-1 py-1.5 text-xs font-bold rounded truncate px-2 ${personTab==='B' ? 'bg-white shadow text-indigo-700':'text-slate-500'}`}>{nameB || 'Person B'}</button>
              </div>
            )}

            {['A', 'B'].filter(p => p === 'A' || isMarried).map(p => (
              <div key={`person-data-${p}`} className={`${personTab === p ? 'block' : 'hidden'} print:block mb-4`}>
                <h3 className="hidden print:block text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Daten {p === 'A' ? (nameA || 'Person A') : (nameB || 'Person B')}</h3>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Geburtsdatum {isMarried ? `(${p === 'A' ? (nameA || 'Person A') : (nameB || 'Person B')})` : ''}</label>
                    <input type="text" placeholder="TT.MM.JJJJ" value={p === 'A' ? birthDateA : birthDateB} onChange={e => handleBirthDateChange(e.target.value, p)} className="w-full border rounded p-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Rentenbeginn {isMarried ? `(${p === 'A' ? (nameA || 'Person A') : (nameB || 'Person B')})` : ''}</label>
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
              <div className="flex justify-between items-center mb-2"><label className="block text-sm font-bold text-indigo-900">Zielnetto im Alter (Kaufkraft heute)</label></div>
              <input type="number" value={targetIncomeToday} onChange={e => setTargetIncomeToday(parseNum(e.target.value))} className="w-full border-2 border-indigo-200 bg-white rounded-lg p-3 text-xl font-black text-indigo-900 mb-3 shadow-inner outline-none focus:border-indigo-400 transition-colors" />
              
              <div className="border-t-2 border-indigo-200/60 pt-3 mt-3">
                 <button onClick={() => setShowBenchmark(!showBenchmark)} className="w-full flex justify-between items-center text-xs font-extrabold text-indigo-800 uppercase tracking-wide hover:opacity-80 transition-opacity print:hidden">
                   <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-indigo-600"/> Benchmark: Gehalts-Prognose</span>
                   {showBenchmark ? <ChevronUp className="w-4 h-4 text-indigo-400"/> : <ChevronDown className="w-4 h-4 text-indigo-400"/>}
                 </button>

                 {showBenchmark && (
                     <div className="mt-5 print:mt-0">
                         {renderSalaryInput('top')}
                         
                         <div className="mb-5">
                             <label className="block text-xs font-semibold text-slate-600 mb-1.5">Angenommenes Gehalts-Plus p.a. (%)</label>
                             <input type="number" step="0.1" value={wageGrowthRate} onChange={e => setWageGrowthRate(parseNum(e.target.value))} className="w-full border border-indigo-200 rounded-lg p-2.5 text-sm font-bold bg-white shadow-sm outline-none focus:border-indigo-400" />
                         </div>
                         <div className="bg-white p-5 rounded-xl shadow-sm border border-indigo-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600 print:hidden"></div>
                            <p className="text-sm text-slate-600 mb-2">Ihr Gehalt steigt bis zur {salaryInputMode==='besoldung' ? 'Pension' : 'Rente'} voraussichtlich auf:</p>
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
              <select value={kvStatus} onChange={e => setKvStatus(e.target.value)} className="w-full border rounded p-2 text-sm mb-2">
                 <option value="kvdr">Gesetzlich (KVdR - Pflicht)</option>
                 <option value="freiwillig">Gesetzlich (Freiwillig)</option>
                 <option value="pkv">Privat versichert (PKV / Beihilfe)</option>
              </select>
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
                <button key={t} className={`flex-1 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${activeTab === t ? 'bg-white text-indigo-700 border-b-2 border-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`} onClick={() => setActiveTab(t)}>{t === 's1' ? 'Schicht 1' : t === 's2' ? 'Schicht 2' : t === 's3' ? 'Schicht 3' : 'Planer'}</button>
              ))}
            </div>
            <div className="p-4 bg-slate-50/50 min-h-[400px] print:min-h-0 print:p-0 print:bg-transparent">
              
              <div className={`${activeTab === 's1' ? 'block' : 'hidden'} print:block print:mb-8`}>
                <h3 className="hidden print:block font-bold text-blue-900 mb-4 border-b border-blue-200 pb-1 text-lg">Eingaben: Schicht 1 (Basis)</h3>
                <div className="space-y-4">
                  {['A', 'B'].filter(p => p === 'A' || isMarried).map(p => {
                    const isPension = p === 'A' ? pensionTypeA === 'pension' : pensionTypeB === 'pension';
                    const setPensionMode = (mode) => p === 'A' ? setPensionTypeA(mode) : setPensionTypeB(mode);

                    return (
                    <div key={`grv-${p}`} className={`${personTab === p ? 'block' : 'hidden'} print:block print:mb-4 bg-white p-4 rounded-lg border border-blue-200 shadow-sm relative print:border-slate-300 print:shadow-none`}>
                      <div className="flex items-center justify-between mb-4 border-b border-blue-50 pb-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-blue-800 print:text-slate-800">
                           {isPension ? <Landmark className="w-4 h-4 print:text-slate-500"/> : <ShieldAlert className="w-4 h-4 print:text-slate-500"/>}
                           {isPension ? 'Beamtenversorgung (Pension)' : 'Gesetzliche Rente'} {isMarried ? `(${p === 'A' ? (nameA || 'Person A') : (nameB || 'Person B')})` : ''}
                        </span>
                      </div>
                      
                      <div className="flex bg-slate-100 p-1 rounded-lg mb-4 print:hidden">
                         <button onClick={() => setPensionMode('grv')} className={`flex-1 py-1.5 text-xs font-bold rounded ${!isPension ? 'bg-white shadow text-blue-700':'text-slate-500'}`}>Gesetzliche RV</button>
                         <button onClick={() => setPensionMode('pension')} className={`flex-1 py-1.5 text-xs font-bold rounded ${isPension ? 'bg-white shadow text-blue-700':'text-slate-500'}`}>Pension (Beamte)</button>
                      </div>

                      {!isPension ? (
                          <>
                              <div className="flex justify-between mb-2">
                                 <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Basiswerte Gesetzliche Rente</div>
                                 <button onClick={() => estimatorPerson === p ? setEstimatorPerson(null) : openEstimator(p)} className="print:hidden text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1 transition-colors"><Calculator className="w-3 h-3"/> {estimatorPerson === p ? 'Schließen' : 'Schätzen'}</button>
                              </div>
                              {estimatorPerson === p && (
                                  <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-inner print:hidden">
                                      <h4 className="text-[10px] font-bold text-blue-800 uppercase mb-2">Schnell-Schätzer (Karriere-Kurve)</h4>
                                      <div className="mb-3">
                                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">Heutiges Bruttojahresgehalt (€)</label>
                                          <input type="number" value={estimatorSalary} onChange={e => setEstimatorSalary(parseNum(e.target.value))} className="w-full border border-blue-200 rounded p-2 text-sm bg-white font-mono font-bold" />
                                      </div>
                                      <button onClick={() => { if (p === 'A') setGrvGrossA(estimatedPension); else setGrvGrossB(estimatedPension); setEstimatorPerson(null); }} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> ca. {estimatedPension} € übernehmen</button>
                                  </div>
                              )}
                              <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-semibold text-slate-600 mb-1">Anspruch (€/M)</label><input type="number" value={p==='A'?grvGrossA:grvGrossB} onChange={e => p==='A'?setGrvGrossA(parseNum(e.target.value)):setGrvGrossB(parseNum(e.target.value))} className="w-full border rounded p-2" /></div>
                                <div><label className="block text-xs font-semibold text-slate-600 mb-1">Rentensteigerung (%)</label><input type="number" step="0.1" value={grvIncreaseRate} onChange={e => { const val = parseNum(e.target.value); setGrvIncreaseRate(val); setTaxIndexRate(val); }} className="w-full border rounded p-2" /></div>
                              </div>
                          </>
                      ) : (
                          <div className="space-y-4 border border-blue-100 p-4 rounded-xl bg-blue-50/30 print:bg-white print:border-slate-200">
                              <div className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5"><Compass className="w-3.5 h-3.5"/> Karriere-Endstufe (zur Pensionierung)</div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs font-semibold text-slate-600 mb-1">End-Besoldung</label>
                                      <select value={p === 'A' ? pensionEndGruppeA : pensionEndGruppeB} onChange={e => p === 'A' ? setPensionEndGruppeA(e.target.value) : setPensionEndGruppeB(e.target.value)} className="w-full border rounded p-2 text-sm font-bold bg-white">
                                          {besoldungsgruppen.map(g => <option key={g} value={g}>{g}</option>)}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-semibold text-slate-600 mb-1">End-Erfahrungsstufe</label>
                                      <select value={p === 'A' ? pensionEndStufeA : pensionEndStufeB} onChange={e => p === 'A' ? setPensionEndStufeA(Number(e.target.value)) : setPensionEndStufeB(Number(e.target.value))} className="w-full border rounded p-2 text-sm font-bold bg-white">
                                          {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Stufe {s}</option>)}
                                      </select>
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 items-end">
                                  <div>
                                      <label className="block text-xs font-semibold text-slate-600 mb-1">Erwarteter Ruhegehaltssatz</label>
                                      <div className="relative">
                                          <input type="number" step="0.1" max="71.75" value={p === 'A' ? pensionSatzA : pensionSatzB} onChange={e => p === 'A' ? setPensionSatzA(parseNum(e.target.value)) : setPensionSatzB(parseNum(e.target.value))} className="w-full border rounded p-2 text-sm font-bold bg-white pr-8" />
                                          <span className="absolute right-3 top-2 text-slate-400">%</span>
                                      </div>
                                  </div>
                                  <div className="bg-white p-2 border border-blue-200 rounded text-center">
                                      <div className="text-[9px] text-slate-500 uppercase font-bold">Errechnete Brutto-Pension</div>
                                      <div className="font-black text-blue-700 text-lg">{formatCurrency(p === 'A' ? computedPensionA : computedPensionB)}</div>
                                  </div>
                              </div>
                              <div className="text-[10px] text-slate-500 italic flex items-start gap-1"><Info className="w-3 h-3 mt-0.5 shrink-0"/> Engine berücksichtigt automatisch den speziellen Versorgungsfreibetrag für Beamte anstatt der Kohortenbesteuerung.</div>
                          </div>
                      )}

                      {((p==='A' ? calculations.grvDiscountA : calculations.grvDiscountB) > 0) && (
                         <div className="mt-3 text-[10px] text-rose-600 bg-rose-50 p-2 rounded flex gap-1.5 border border-rose-100"><AlertCircle className="w-3 h-3 shrink-0" /><span>Vorruhestand: Es werden automatisch {((p==='A' ? calculations.grvDiscountA : calculations.grvDiscountB)*100).toFixed(1)}% Abschlag berechnet.</span></div>
                      )}
                    </div>
                  )})}
                  {contracts.filter(c => c.layer === 1).map(renderContractInput)}
                  <button onClick={() => addContract(1)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 hover:border-blue-400 hover:text-blue-600 print:hidden"><PlusCircle className="w-4 h-4" /> Rürup hinzufügen</button>
                </div>
              </div>

              <div className={`${activeTab === 's2' ? 'block' : 'hidden'} print:block print:mb-8`}>
                <h3 className={`hidden ${contracts.filter(c => c.layer === 2).length > 0 ? 'print:block' : 'print:hidden'} font-bold text-purple-900 mb-4 border-b border-purple-200 pb-1 text-lg`}>Eingaben: Schicht 2 (Zusatz)</h3>
                <div className="space-y-4">
                  {contracts.filter(c => c.layer === 2).map(renderContractInput)}
                  <button onClick={() => addContract(2)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 hover:border-purple-400 hover:text-purple-600 print:hidden"><PlusCircle className="w-4 h-4" /> bAV / Riester hinzufügen</button>
                </div>
              </div>

              <div className={`${activeTab === 's3' ? 'block' : 'hidden'} print:block print:mb-8`}>
                <h3 className={`hidden ${contracts.filter(c => c.layer === 3).length > 0 ? 'print:block' : 'print:hidden'} font-bold text-emerald-900 mb-4 border-b border-emerald-200 pb-1 text-lg`}>Eingaben: Schicht 3 (Privat)</h3>
                <div className="space-y-4">
                  {contracts.filter(c => c.layer === 3).map(renderContractInput)}
                  <button onClick={() => addContract(3)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 flex items-center justify-center gap-2 hover:border-emerald-400 hover:text-emerald-600 print:hidden"><PlusCircle className="w-4 h-4" /> Vertrag / Depot hinzufügen</button>
                </div>
              </div>

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
          </div>
        </div>

        {/* RIGHT COLUMN: RESULTS */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-6 print:col-span-12">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:mt-0">
            <h2 className="hidden print:block col-span-1 sm:col-span-2 text-xl font-bold uppercase tracking-widest border-b-2 border-slate-200 pb-2 mb-4 text-slate-800 mt-4 print:mt-0 break-inside-avoid">2. Ergebnis: Ihr Kassenbon im Rentenalter</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 mb-1">Haushalts-Bedarf im Jahr {calculations.baseRetYear}</h3>
              <div className="text-3xl font-bold">{renderBonVal(calculations.targetIncomeFuture)}</div>
            </div>
            <div className={`bg-white rounded-xl shadow-sm border p-6 ${calculations.gap > 0 ? 'border-rose-200 text-rose-600' : 'border-emerald-200 text-emerald-600'}`}>
              <h3 className="text-sm font-semibold mb-1">Versorgungslücke</h3>
              <div className="text-3xl font-bold">{calculations.gap > 0 ? renderBonVal(calculations.gap) : 'Gedeckt'}</div>
            </div>
          </div>

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
              </div>
            )}
          </div>

          <div className="flex bg-slate-200/50 p-1 rounded border print:hidden">
            <button onClick={() => setRightView('zusammensetzung')} className={`flex-1 py-2 rounded text-xs font-bold flex justify-center gap-2 ${rightView === 'zusammensetzung' ? 'bg-white shadow' : 'text-slate-500'}`}><List className="w-4 h-4" /> Kassenbon</button>
            <button onClick={() => setRightView('verlauf')} className={`flex-1 py-2 rounded text-xs font-bold flex justify-center gap-2 ${rightView === 'verlauf' ? 'bg-white shadow' : 'text-slate-500'}`}><LineChartIcon className="w-4 h-4" /> Verlauf</button>
          </div>

          <div className={`bg-white rounded-xl shadow-sm border p-6 print:block print:break-inside-avoid ${rightView === 'zusammensetzung' ? 'block' : 'hidden'}`}>
            <h2 className="text-sm font-bold mb-4 print:hidden">Ihr Haushalts-Netto im Jahr {calculations.baseRetYear}</h2>
            
            <div className="mb-6 print:mt-4">
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mb-1">
                <span>Ziel-Erreichung</span>
                <span>{calculations.gap > 0 && calculations.targetIncomeFuture > 0 ? `${((calculations.totalNetFuture / calculations.targetIncomeFuture) * 100).toFixed(1)} % erreicht` : 'Ziel erreicht / übertroffen'}</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full flex overflow-hidden shadow-inner border border-slate-200" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                {(calculations.s1_net > 0) && <div style={{ width: `${(calculations.s1_net / Math.max(calculations.targetIncomeFuture, calculations.totalNetFuture) || 1) * 100}%`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} className="bg-blue-500 transition-all duration-500"></div>}
                {(calculations.s2_net > 0) && <div style={{ width: `${(calculations.s2_net / Math.max(calculations.targetIncomeFuture, calculations.totalNetFuture) || 1) * 100}%`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} className="bg-purple-500 transition-all duration-500"></div>}
                {(calculations.s3_net > 0) && <div style={{ width: `${(calculations.s3_net / Math.max(calculations.targetIncomeFuture, calculations.totalNetFuture) || 1) * 100}%`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} className="bg-emerald-500 transition-all duration-500"></div>}
                {(calculations.gap > 0) && <div style={{ width: `${(calculations.gap / Math.max(calculations.targetIncomeFuture, calculations.totalNetFuture) || 1) * 100}%`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} className="bg-white transition-all duration-500"></div>}
              </div>
              <div className="flex gap-3 mt-2 text-[9px] font-semibold text-slate-500 flex-wrap">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}></span> Schicht 1</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}></span> Schicht 2</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}></span> Schicht 3</div>
                {calculations.gap > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white border border-slate-300" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}></span> Lücke</div>}
              </div>
            </div>

            <div className="space-y-4">
              <div className="border border-blue-100 rounded-lg print:border-slate-300 overflow-hidden mb-3">
                <div className="flex justify-between p-3 sm:p-4 bg-white cursor-pointer print:bg-white border-b border-blue-50" onClick={() => toggleSection('s1')}>
                  <div className="font-bold text-sm sm:text-base text-blue-900">Schicht 1 (Basis / Pension)</div>
                  <div className="font-bold text-sm sm:text-base">{renderBonVal(calculations.s1_net)}</div>
                </div>
                <div className={`p-3 bg-white text-xs space-y-2 ${expandedSections.s1 ? 'block' : 'hidden'} print:block print:space-y-0 print:p-0 print:mt-2`}>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2 break-inside-avoid">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-semibold text-sm text-blue-900">{pensionTypeA === 'pension' || pensionTypeB === 'pension' ? 'Rente / Pension (Haushalt)' : 'Gesetzliche Rente (Haushalt)'}</div>
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

              <div className="border border-purple-100 rounded-lg print:border-slate-300 overflow-hidden mb-3">
                <div className="flex justify-between p-3 sm:p-4 bg-white cursor-pointer print:bg-white border-b border-purple-50" onClick={() => toggleSection('s2')}>
                  <div className="font-bold text-sm sm:text-base text-purple-900">Schicht 2 (Zusatz)</div>
                  <div className="font-bold text-sm sm:text-base">{renderBonVal(calculations.s2_net)}</div>
                </div>
                <div className={`p-3 bg-white text-xs space-y-2 ${expandedSections.s2 ? 'block' : 'hidden'} print:block print:space-y-0 print:p-0 print:mt-2`}>
                   {calculations.contracts.filter(c=>c.layer===2).map(c => renderBonContract(c))}
                </div>
              </div>

              <div className="border border-emerald-100 rounded-lg print:border-slate-300 overflow-hidden mb-3">
                <div className="flex justify-between p-3 sm:p-4 bg-white cursor-pointer print:bg-white border-b border-emerald-50" onClick={() => toggleSection('s3')}>
                  <div className="font-bold text-sm sm:text-base text-emerald-900">Schicht 3 (Privat)</div>
                  <div className="font-bold text-sm sm:text-base">{renderBonVal(calculations.s3_net)}</div>
                </div>
                <div className={`p-3 bg-white text-xs space-y-2 ${expandedSections.s3 ? 'block' : 'hidden'} print:block print:space-y-0 print:p-0 print:mt-2`}>
                  {calculations.contracts.filter(c=>c.layer===3).map(c => renderBonContract(c))}
                  {includePlanerInNet && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2 break-inside-avoid">
                       <div className="flex justify-between items-center mb-1"><div className="font-semibold text-sm text-blue-900">Planer Wunsch-Rente</div><div className="font-bold text-base text-slate-800">{renderBonVal(calculations.finalPlanerWithdrawal)}</div></div>
                       <div className="flex justify-between items-end text-[10px] text-slate-500">
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
                       style={{ left: `${(hoveredData.cx / svgWidth) * 100}%`, top: '20px', transform: hoveredData.index > visibleChartData.length / 2 ? 'translateX(calc(-100% - 15px))' : 'translateX(15px)' }}>
                      <div className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Alter {hoveredData.age} (Jahr {hoveredData.year})</div>
                      {!hoveredData.isRetirement ? (
                          <div className="text-slate-600 flex justify-between gap-4"><span>Gehalt (Netto):</span> <span className="font-bold">{formatChartCurrency(hoveredData.totalNet, hoveredData.discount)}</span></div>
                      ) : (
                          <><div className="text-indigo-600 flex justify-between gap-4 mb-1"><span>Gesamt-Netto:</span> <span className="font-bold">{formatChartCurrency(hoveredData.totalNet, hoveredData.discount)}</span></div>{includePlanerInNet && hoveredData.planer > 0 && <div className="text-[10px] text-slate-500 flex justify-between gap-4"><span>davon Planer:</span> <span>{formatChartCurrency(hoveredData.planer, hoveredData.discount)}</span></div>}</>
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
                        <><text x={cx} y={svgHeight - 10} fontSize="12" fontWeight="bold" fill="#64748b" textAnchor="middle">{d.age} J.</text><line x1={cx} y1={svgHeight - bottomPadding} x2={cx} y2={svgHeight - bottomPadding + 5} stroke="#cbd5e1" /></>
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
            
            <div className="mt-8 flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 print:hidden shadow-inner">
               <span className="text-xs font-bold text-slate-500 whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm">Alter {Math.floor(calculations.currentAgeA)}</span>
               <div className="flex-1 relative">
                 <input type="range" min={Math.floor(calculations.currentAgeA)} max={105 - chartWindowSize} value={activeStartAge} onChange={e => setManualChartStart(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                 <div className="text-[10px] text-center text-slate-400 font-medium mt-1 uppercase tracking-wider">Zeitleiste verschieben</div>
               </div>
               <span className="text-xs font-bold text-slate-500 whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm">Alter 105</span>
               <div className="w-px h-6 bg-slate-300 mx-1"></div>
               <button onClick={() => setManualChartStart(null)} className="text-xs flex items-center gap-1.5 bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-100 hover:text-indigo-600 transition-all shadow-sm" title="Zurück zum Renteneintritt springen"><Clock className="w-3.5 h-3.5" /> Fokus Rente</button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 text-white print:bg-white print:text-slate-800 print:border-slate-300 print:break-inside-avoid overflow-hidden">
              <button onClick={() => setShowOptimizer(!showOptimizer)} className="w-full p-6 flex justify-between items-center hover:bg-slate-800 transition-colors print:bg-slate-50">
                  <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2 print:text-indigo-700"><Activity className="w-5 h-5" /> Smart Optimizer: Rentenlücke schließen</h3>
                  {showOptimizer ? <ChevronUp className="w-5 h-5 text-slate-400 print:text-slate-500"/> : <ChevronDown className="w-5 h-5 text-slate-400 print:text-slate-500"/>}
              </button>
              
              {showOptimizer && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-800 print:border-slate-200">
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
                               <div className="flex-1">
                                   <label className="block text-[9px] text-slate-400 uppercase mb-1">Rendite p.a. (%)</label>
                                   <input type="number" step="0.01" value={solutionSavingsReturn ?? ''} onChange={e => setSolutionSavingsReturn(parseNum(e.target.value))} className="w-full bg-slate-800 text-xs text-white p-1.5 rounded print:bg-white print:text-black print:border outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500" placeholder="z.B. 5.5" />
                               </div>
                               <div className="flex-1">
                                   <label className="block text-[9px] text-slate-400 uppercase mb-1">Dyn. Sparrate</label>
                                   <select value={solutionSavingsDynamic} onChange={e => setSolutionSavingsDynamic(Number(e.target.value))} className="w-full bg-slate-800 text-xs text-white p-1.5 rounded print:bg-white print:text-black print:border outline-none focus:ring-1 focus:ring-indigo-500">
                                       {[0, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10].map(v => <option key={v} value={v}>{v.toFixed(1)} %</option>)}
                                   </select>
                                   {solutionSavingsDynamic > 0 && calculations.requiredSavings > 0 && (
                                       <div className="text-[9px] text-slate-400 mt-1.5 leading-tight">
                                           Letzte Rate (vor Rente):<br/><span className="font-bold text-slate-300 print:text-slate-600">{formatCurrency(calculations.requiredSavings * Math.pow(1 + solutionSavingsDynamic / 100, Math.max(0, Math.floor(calculations.maxYearsToRet) - 1)))}</span>
                                       </div>
                                   )}
                               </div>
                          </div>
                      </div>
                  )}
                </div>
              )}
          </div>

        </div>
      </main>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 mb-24 print:block print:break-before-page">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b-2 border-amber-200 pb-4">
             <div>
                 <div className="flex items-center gap-3 font-bold text-amber-800 text-2xl"><SearchCheck className="w-8 h-8"/> Vertrags-TÜV: Der große Vergleich</div>
                 <p className="text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed">Stellen Sie Ihre Verträge direkt nebeneinander. Die Engine berechnet Ihren exakten Grenzsteuersatz und die reale SV-Ersparnis auf Basis Ihres Gehalts ({formatCurrency(currentFinancials.avgMonthlyGross)} Brutto / Monat).</p>
             </div>
             <div className="shrink-0 bg-amber-100 p-2 rounded-xl border border-amber-200 shadow-sm relative z-10">
                 <select value="" onChange={(e) => { if(e.target.value) addTuevItem(e.target.value); }} className="bg-white border-2 border-amber-300 text-amber-900 rounded-lg p-2.5 text-sm font-bold shadow-sm outline-none hover:border-amber-400 cursor-pointer w-full md:w-auto">
                     <option value="">➕ Vertrag hinzufügen...</option>
                     {contracts.filter(c => ['basis', 'bav', 'bavKapital', 'riester', 'prvRente', 'prvKapital', 'etf'].includes(c.type)).map(c => (
                        <option key={c.id} value={c.id}>Schicht {c.layer} | {c.name || c.type.toUpperCase()}</option>
                     ))}
                 </select>
             </div>
         </div>
         
         {renderSalaryInput('tuev')}
         
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
             <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center group relative">
                <div className="text-[11px] text-slate-500 uppercase font-bold mb-0.5">Ihr heutiger Grenzsteuersatz</div>
                <div className="text-lg font-black text-emerald-600">{(tuevData.marginalTaxNow * 100).toFixed(1)} %</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-tight">Steuerersparnis auf genau die Euro, die in die bAV/Rürup fließen (Progressionsspitze, <strong>nicht</strong> der Durchschnittsteuersatz!).</div>
             </div>
             <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-400"></div>
                <div className="text-[11px] text-slate-500 uppercase font-bold mb-0.5">Ihre SV-Ersparnis heute</div>
                <div className="text-lg font-black text-emerald-600">{(tuevData.svNow * 100).toFixed(1)} %</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-tight">Ersparnis bei RV/AV/KV/PV. <br/><span className="text-emerald-700 font-bold">Status: {tuevData.svText}</span></div>
             </div>
             <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="text-[11px] text-slate-500 uppercase font-bold mb-0.5">Grenzsteuersatz im Rentenalter</div>
                <div className="text-lg font-black text-rose-600">{(tuevData.taxRetirement * 100).toFixed(1)} %</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-tight">Dieser exakte Satz wird später als Abzug auf Ihre Auszahlungen fällig.</div>
             </div>
         </div>
         
         {tuevData.items.length === 0 ? (
             <div className="bg-amber-50 h-48 rounded-xl border-2 border-dashed border-amber-200 flex flex-col items-center justify-center text-amber-600/50">
                 <Activity className="w-12 h-12 mb-2" />
                 <p className="text-sm font-medium">Bitte fügen Sie oben rechts einen Vertrag hinzu, um den Vergleich zu starten.</p>
             </div>
         ) : (
             <div className="flex flex-col gap-6 print:gap-4 pb-6 pt-2 px-1">
                 {tuevData.items.map((item, index) => {
                     const selectedC = contracts.find(c => c.id === item.contractId);
                     if (item.invalid || !selectedC) return null;
                     
                     return (
                         <div key={item.id} className="bg-white rounded-xl shadow-md border border-slate-200 shrink-0 flex flex-col lg:flex-row print:flex-row overflow-hidden relative w-full print:break-inside-avoid print:shadow-none print:border-slate-300">
                             
                             {item.payoutGross === 0 && (
                                 <div className="absolute top-0 left-0 right-0 z-10 bg-rose-50 text-rose-600 text-xs p-2.5 print:p-2 border-b border-rose-200 flex items-center justify-center gap-2">
                                     <AlertCircle className="w-5 h-5 shrink-0 print:w-4 print:h-4" />
                                     <span className="print:text-xs">Dieser Vertrag generiert noch keine Rente/Kapitalauszahlung (Wert ist 0). Bitte oben im Planer eine Zielsumme hinterlegen!</span>
                                 </div>
                             )}

                             {/* LEFT COLUMN: Inputs */}
                             <div className={`w-full lg:w-[30%] print:w-[30%] p-5 print:p-4 bg-slate-50 border-b lg:border-b-0 print:border-b-0 lg:border-r print:border-r border-slate-200 ${item.payoutGross === 0 ? 'pt-12 print:pt-10' : ''}`}>
                                 <div className="flex justify-between items-start mb-5 print:mb-3">
                                     <div>
                                         <div className="text-[11px] print:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Schicht {item.layer} | {item.cType.toUpperCase()}</div>
                                         <div className="font-bold text-slate-800 text-lg" title={item.name}>{item.name || 'Ohne Name'}</div>
                                     </div>
                                     <button onClick={() => removeTuevItem(item.id)} className="text-slate-400 hover:bg-rose-100 hover:text-rose-600 p-2 rounded-lg transition-colors print:hidden" title="Aus Vergleich entfernen"><Trash className="w-5 h-5" /></button>
                                 </div>

                                 <div className="space-y-4 print:space-y-3">
                                     {item.cType !== 'riester' && (
                                         <div className="grid grid-cols-2 gap-4 print:gap-3 mb-4">
                                             <div>
                                                 <label className="block text-[11px] font-bold text-slate-500 mb-1.5 print:mb-1">{item.cType === 'etf' ? 'Mtl. Sparrate (Start)' : 'Mtl. Beitrag (Start)'}</label>
                                                 <input type="number" value={item.grossMonthly} onChange={e => updateTuevItem(item.id, 'grossMonthly', parseNum(e.target.value))} className="w-full border border-slate-300 rounded-md p-2 print:p-1.5 text-sm font-semibold bg-white shadow-sm print:shadow-none" />
                                             </div>
                                             <div>
                                                 <label className="block text-[11px] font-bold text-slate-500 mb-1.5 print:mb-1">Dynamik p.a. (%)</label>
                                                 <input type="number" step="0.1" value={item.dynamic || 0} onChange={e => updateTuevItem(item.id, 'dynamic', parseNum(e.target.value))} className="w-full border border-slate-300 rounded-md p-2 print:p-1.5 text-sm font-semibold bg-white shadow-sm print:shadow-none" />
                                             </div>
                                         </div>
                                     )}

                                     {item.cType === 'riester' && (
                                         <>
                                             <div className="grid grid-cols-2 gap-4 print:gap-3 mb-4">
                                                 <div>
                                                     <label className="block text-[11px] font-bold text-slate-500 mb-1.5 print:mb-1">Start-Eigenbeitrag (€)</label>
                                                     <input type="number" value={item.grossMonthly} onChange={e => updateTuevItem(item.id, 'grossMonthly', parseNum(e.target.value))} className="w-full border border-slate-300 rounded-md p-2 print:p-1.5 text-sm font-semibold bg-white shadow-sm print:shadow-none" />
                                                 </div>
                                                 <div>
                                                     <label className="block text-[11px] font-bold text-slate-500 mb-1.5 print:mb-1">Dynamik p.a. (%)</label>
                                                     <input type="number" step="0.1" value={item.dynamic || 0} onChange={e => updateTuevItem(item.id, 'dynamic', parseNum(e.target.value))} className="w-full border border-slate-300 rounded-md p-2 print:p-1.5 text-sm font-semibold bg-white shadow-sm print:shadow-none" />
                                                 </div>
                                             </div>
                                             <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 print:bg-white print:border-slate-200">
                                                 <div className="mb-3">
                                                     <label className="block text-xs font-bold text-slate-500 mb-1.5 print:mb-1">Jährliche Grundzulage (€)</label>
                                                     <input type="number" value={item.subsidyRiester} onChange={e => updateTuevItem(item.id, 'subsidyRiester', parseNum(e.target.value))} className="w-full border border-blue-200 rounded-md p-1.5 text-sm bg-white" />
                                                 </div>
                                                 <div className="pt-3 border-t border-blue-100/50">
                                                     <div className="flex justify-between items-center mb-2">
                                                         <label className="block text-xs font-bold text-blue-900 print:text-slate-700">Kinderzulagen</label>
                                                         <button onClick={() => addTuevChild(item.id)} className="text-[10px] bg-blue-600 text-white px-2 py-1.5 rounded font-bold hover:bg-blue-700 transition-colors print:hidden flex items-center gap-1 shadow-sm"><PlusCircle className="w-3 h-3"/> Kind</button>
                                                     </div>
                                                     {(item.children || []).map((child) => {
                                                         const amount = child.birthYear >= 2008 ? 300 : 185;
                                                         const currentYearNum = new Date().getFullYear();
                                                         const remaining = Math.max(0, 25 - (currentYearNum - child.birthYear));
                                                         return (
                                                             <div key={child.id} className="flex items-center gap-2 mb-2 last:mb-0">
                                                                 <div className="flex-1 relative">
                                                                     <input type="number" value={child.birthYear} onChange={e => updateTuevChild(item.id, child.id, 'birthYear', parseNum(e.target.value))} className="w-full border border-blue-200 rounded p-1.5 text-xs bg-white pl-14" placeholder="Jahr"/>
                                                                     <span className="absolute left-2 top-2 text-[10px] uppercase text-slate-400 font-bold">Geb.</span>
                                                                 </div>
                                                                 <div className={`border rounded px-2 py-1.5 text-xs font-bold w-[70px] text-center ${remaining > 0 ? 'bg-white border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-400 line-through'}`}>+{amount} €</div>
                                                                 <div className="text-[10px] text-slate-500 w-12 text-right leading-tight hidden sm:block">
                                                                    {remaining > 0 ? `noch ${remaining} J.` : 'Abgelaufen'}
                                                                 </div>
                                                                 <button onClick={() => removeTuevChild(item.id, child.id)} className="text-slate-300 hover:text-rose-500 print:hidden transition-colors"><Trash className="w-4 h-4"/></button>
                                                             </div>
                                                         )
                                                     })}
                                                     {(!item.children || item.children.length === 0) && (
                                                         <div className="text-[10px] text-slate-400 italic">Keine Kinderzulagen hinterlegt.</div>
                                                     )}
                                                 </div>
                                             </div>
                                         </>
                                     )}
                                     
                                     {item.cType.includes('bav') && (
                                         <div><label className="block text-xs font-bold text-slate-500 mb-1.5 print:mb-1">Davon AG-Zuschuss (Start-Wert)</label><input type="number" value={item.subsidyBav} onChange={e => updateTuevItem(item.id, 'subsidyBav', parseNum(e.target.value))} className="w-full border border-slate-300 rounded-md p-2 print:p-1.5 text-sm bg-white shadow-sm print:shadow-none" /></div>
                                     )}

                                     <div className="grid grid-cols-2 gap-4 print:gap-3">
                                         <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1.5 print:mb-1">Vertragsbeginn</label>
                                            <input type="text" placeholder="TT.MM.JJJJ" value={item.safeStartDate} onChange={e => updateTuevItem(item.id, 'startDate', formatDateInput(e.target.value))} className="w-full border border-slate-300 rounded-md p-2 print:p-1.5 text-sm bg-white shadow-sm print:shadow-none" />
                                         </div>
                                         {(!item.isKapital && item.cType !== 'etf') && (
                                             <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1.5 print:mb-1">Lebenserwartung</label>
                                                <div className="relative">
                                                   <input type="number" value={item.safeLifeExpectancy} onChange={e => updateTuevItem(item.id, 'lifeExpectancy', parseNum(e.target.value))} className="w-full border border-slate-300 rounded-md p-2 print:p-1.5 text-sm bg-white shadow-sm print:shadow-none pr-12 print:pr-10" />
                                                   <span className="absolute right-3 print:right-2 top-2 print:top-1.5 text-sm print:text-xs text-slate-400">Alter</span>
                                                </div>
                                             </div>
                                         )}
                                         {(item.cType === 'etf' && !item.isKapital) && (
                                             <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1.5 print:mb-1">Entnahme-Dauer</label>
                                                <div className="text-sm font-bold text-slate-700 bg-slate-100 p-2 print:p-1.5 rounded-md border border-slate-200">
                                                    {item.statutoryYears} Jahre
                                                </div>
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             </div>

                             {/* MIDDLE COLUMN: Einzahlung vs Auszahlung */}
                             <div className={`w-full lg:w-[32%] print:w-[32%] p-5 print:p-4 flex flex-col justify-center gap-4 print:gap-3 border-b lg:border-b-0 print:border-b-0 lg:border-r print:border-r border-slate-100 ${item.payoutGross === 0 ? 'pt-12 print:pt-10' : ''}`}>
                                 <div className="bg-slate-50 rounded-xl print:rounded-lg p-3 print:p-2.5 border border-slate-200">
                                     <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Ihre echte Belastung (Ansparphase)</div>
                                     <div className="space-y-1 mb-2 relative group">
                                         {item.cType === 'riester' ? (
                                             <>
                                                <div className="flex justify-between text-[11px] text-slate-600"><span>Mtl. Eigenbeitrag (Start):</span> <span>{formatCurrency(item.grossMonthly)}</span></div>
                                                <div className="flex justify-between text-[11px] text-emerald-600" title="Zulagen mindern nicht den monatlichen Aufwand, sondern fließen zusätzlich in Vertrag."><span>+ Zulagen (in Vertrag) <Info className="w-3 h-3 inline opacity-50"/>:</span> <span>+ {formatCurrency(item.snapshotZulage)}</span></div>
                                                {item.snapshotSteuerErsparnis > 0 && <div className="flex justify-between text-[11px] text-emerald-600 cursor-help" title={`Günstigerprüfung: Max. 2100€ p.a. werden mit Ihrem Grenzsteuersatz (${(tuevData.marginalTaxNow*100).toFixed(1)}%) multipliziert. Davon werden die Zulagen abgezogen.`}><span>- Steuer-Erstattung (Start) <Info className="w-3 h-3 inline text-emerald-400"/>:</span> <span>- {formatCurrency(item.snapshotSteuerErsparnis)}</span></div>}
                                             </>
                                         ) : item.cType.includes('bav') ? (
                                             <>
                                                 <div className="flex justify-between text-[11px] text-slate-600"><span>Gesamtbeitrag (Start):</span> <span>{formatCurrency(item.grossMonthly)}</span></div>
                                                 {item.agZuschuss > 0 && <div className="flex justify-between text-[11px] text-emerald-600"><span>- AG-Zuschuss (Start):</span> <span>- {formatCurrency(item.agZuschuss)}</span></div>}
                                                 <div className="flex justify-between text-[11px] font-bold text-slate-700 border-t border-slate-200 pt-1 mt-1"><span>= Entgeltumwandlung (Start):</span> <span>{formatCurrency(item.grossMonthly - item.agZuschuss)}</span></div>
                                             </>
                                         ) : (
                                             <div className="flex justify-between text-[11px] text-slate-600"><span>{item.cType === 'etf' ? 'Sparrate' : 'Brutto-Beitrag'} (Start):</span> <span>{formatCurrency(item.grossMonthly)}</span></div>
                                         )}
                                         
                                         {item.cType !== 'riester' && item.svErsparnis > 0 && <div className="flex justify-between text-[11px] text-emerald-600"><span>- SV-Ersparnis:</span> <span>- {formatCurrency(item.svErsparnis)}</span></div>}
                                         {item.cType !== 'riester' && item.cType.includes('bav') && item.svErsparnis === 0 && (
                                             <div className="flex justify-between text-[9px] text-slate-400 italic"><span>- SV-Ersparnis:</span> <span>0 € ({salaryInputMode === 'besoldung' ? 'Beamte' : 'über BBG'})</span></div>
                                         )}

                                         {item.cType !== 'riester' && item.steuerErsparnis > 0 && <div className="flex justify-between text-[11px] text-emerald-600 cursor-help" title={item.cType === 'basis' ? `Der Beitrag wird zu 100% als Sonderausgabe angesetzt und mindert Ihre Steuerlast um Ihren Grenzsteuersatz (${(tuevData.marginalTaxNow*100).toFixed(1)}%).` : `Die Entgeltumwandlung (minus SV-Ersparnis) ist steuerfrei. Ersparnis = Betrag × Grenzsteuersatz (${(tuevData.marginalTaxNow*100).toFixed(1)}%).`}><span>- Steuer-Ersparnis <Info className="w-3 h-3 inline text-emerald-400"/>:</span> <span>- {formatCurrency(item.steuerErsparnis)}</span></div>}
                                     </div>
                                     {item.cType === 'etf' && (selectedC.capital > 0 || selectedC.specialPayment > 0) && (
                                         <div className="text-[9px] text-slate-500 italic mt-1 pt-1 border-t border-slate-100 leading-tight">
                                            zzgl. Startkapital {formatCurrency(selectedC.capital || 0)} 
                                            {selectedC.specialPayment > 0 ? ` & Einmalzahlung ${formatCurrency(selectedC.specialPayment)}` : ''}
                                         </div>
                                     )}
                                     <div className="flex justify-between items-end border-t border-slate-200 pt-2 mt-2">
                                         <div className="text-xs font-bold text-slate-800">Netto-Aufwand (Start):</div>
                                         <div className="text-right">
                                             <div className="text-sm font-black text-slate-800">{formatCurrency(item.echterNettoAufwand)} <span className="text-[11px] font-normal text-slate-500">/ M</span></div>
                                             <div className="text-[11px] text-slate-500 font-medium mt-0.5">Gesamt {item.dynamic > 0 ? '(inkl. Dyn.)' : 'bis Rente'}: {formatCurrency(item.summeNettoEinzahlung)}</div>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="bg-amber-50 rounded-xl print:rounded-lg p-3 print:p-2.5 border border-amber-200">
                                     <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2">Ihr echter Ertrag (Auszahlungsphase)</div>
                                     <div className="space-y-1 mb-2">
                                         <div className="flex justify-between text-[11px] text-slate-600"><span>Brutto {item.isKapital ? 'Kapital' : 'Rente'}:</span> <span className="font-bold">{formatCurrency(item.payoutGross)}</span></div>
                                         {!item.isKapital && item.kvPvAbzug > 0 && <div className="flex justify-between text-[11px] text-rose-500"><span>KV/PV-Abzug:</span> <span>- {formatCurrency(item.kvPvAbzug)}</span></div>}
                                         {!item.isKapital && item.steuerAbzug > 0 && <div className="flex justify-between text-[11px] text-rose-500"><span>Steuer-Abzug:</span> <span>- {formatCurrency(item.steuerAbzug)}</span></div>}
                                         {item.isKapital && <div className="text-[11px] text-rose-500 text-right italic mt-0.5">Steuern/Abgaben bereits abgezogen</div>}
                                     </div>
                                     <div className="flex justify-between items-end border-t border-amber-200 pt-2">
                                         <div className="text-xs font-bold text-amber-900">Echtes Netto {item.isKapital ? 'Kapital' : '(Mtl.)'}:</div>
                                         <div className="text-right">
                                             <div className="text-sm font-black text-amber-600">{formatCurrency(item.isKapital ? item.echteNettoKapital : item.echteNettoRente)}</div>
                                             {!item.isKapital && <div className="text-[11px] text-amber-700/80 font-medium">Gesamt in Rente: {formatCurrency(item.summeNettoAuszahlung)}</div>}
                                         </div>
                                     </div>
                                 </div>
                             </div>

                             {/* RIGHT COLUMN: KPIs */}
                             <div className={`w-full lg:w-[38%] print:w-[38%] p-6 print:p-5 bg-white flex flex-col justify-center gap-6 print:gap-5 ${item.payoutGross === 0 ? 'pt-12 print:pt-10' : ''}`}>
                                 <div>
                                     <div className="flex justify-between items-end mb-1.5 print:mb-1">
                                         <span className="text-sm font-bold text-slate-500">Netto-Rendite (p.a.)</span>
                                         <span className={`text-2xl print:text-xl font-black ${item.irr > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{item.irr.toFixed(2)} %</span>
                                     </div>
                                     <div className="w-full bg-slate-100 h-2.5 print:h-2 rounded-full mt-1.5 print:mt-1 overflow-hidden">
                                         <div className={`h-full ${item.irr > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, Math.max(0, (item.irr + 5) * 5))}%` }}></div>
                                     </div>
                                 </div>
                                 
                                 <div className="pt-5 print:pt-4 border-t border-slate-100">
                                     <div className="flex justify-between items-center mb-2 print:mb-1.5">
                                         <span className="text-sm font-bold text-slate-600">Hebelfaktor</span>
                                         <span className="text-xl print:text-lg font-black text-indigo-600">{item.nettoHebel.toFixed(2)} x</span>
                                     </div>
                                     <div className="text-xs print:text-[11px] text-slate-500 leading-tight">Aus <strong className="text-slate-600">{formatCurrency(item.summeNettoEinzahlung)}</strong> Netto-Einsatz werden insgesamt <strong className="text-slate-600">{formatCurrency(item.summeNettoAuszahlung)}</strong> Netto-Ertrag.</div>
                                 </div>
                                 
                                 {!item.isKapital ? (
                                     <div className="pt-5 print:pt-4 border-t border-slate-100">
                                         <div className="flex justify-between items-center mb-2 print:mb-1.5">
                                             <span className="text-sm font-bold text-slate-600">Amortisation</span>
                                             <span className="text-xl print:text-lg font-black text-slate-800">{item.amortisationsJahre.toFixed(1)} Jahre</span>
                                         </div>
                                         <div className="text-xs print:text-[11px] text-slate-500 leading-tight">
                                             Nach {item.amortisationsJahre.toFixed(1)} Jahren {item.cType === 'etf' ? 'Entnahme' : 'Rentenbezug'} haben Sie Ihre Netto-Gesamteinzahlung komplett wieder zurückerhalten. 
                                             {item.cType === 'etf' && <span className="block mt-1 italic">Tipp: Durch Rendite in der Entnahmephase arbeitet Ihr Restkapital weiter für Sie.</span>}
                                         </div>
                                     </div>
                                 ) : (
                                     <div className="pt-5 print:pt-4 border-t border-slate-100">
                                         <div className="flex justify-between items-center mb-2 print:mb-1.5">
                                             <span className="text-sm font-bold text-slate-600">Netto-Gewinn</span>
                                             <span className={`text-xl print:text-lg font-black ${item.echterNettoGewinn >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                 {item.echterNettoGewinn >= 0 ? '+' : ''}{formatCurrency(item.echterNettoGewinn)}
                                             </span>
                                         </div>
                                         <div className="text-xs print:text-[11px] text-slate-500 leading-tight">Zieht man Ihre gesamten Netto-Einzahlungen (<strong className="text-slate-700">{formatCurrency(item.summeNettoEinzahlung)}</strong>) vom Endkapital ab, bleibt dieser reine Gewinn nach Steuern zur freien Verfügung.</div>
                                     </div>
                                 )}
                             </div>
                         </div>
                     );
                 })}
             </div>
         )}
      </div>

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
                     <h3 className="font-bold text-lg mb-1 text-slate-900">Exkurs: Die Beamtenversorgung (Pension)</h3>
                     <p>Beamtenpensionen unterliegen <strong>nicht</strong> der Kohortenbesteuerung, sondern der Besteuerung nach § 19 EStG inkl. <strong>Versorgungsfreibetrag</strong>. Dieser Freibetrag sinkt (ähnlich dem steuerfreien Anteil der Rente) abhängig vom Jahr des Eintritts in den Ruhestand ab (im Jahr 2026 beträgt er noch ca. 12,0 % plus 270 € Zuschlag, bis maximal 1.170 € im Jahr). Zudem zahlen Beamte auch im Ruhestand keine Renten- und Arbeitslosenversicherung, sondern führen in der Regel lediglich ihre PKV-Beiträge ab.</p>
                  </div>
                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-1 text-slate-900">2. Schicht 2 (Betriebliche Altersvorsorge & Riester)</h3>
                     <p>Betriebs- und Riester-Renten sind in der Auszahlungsphase <strong>voll einkommensteuerpflichtig</strong>. Bei Betriebsrenten (bAV) aus einer Entgeltumwandlung müssen gesetzlich Versicherte in der Auszahlungsphase zudem die <strong>vollen Beiträge zur Kranken- und Pflegeversicherung</strong> (Arbeitnehmer- und Arbeitgeberanteil) abführen. Beamte oder Privatversicherte (PKV) sind von diesem gesonderten KV/PV-Abzug bei bAV oder Basisrenten ausgenommen.</p>
                  </div>
                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-1 text-slate-900">3. Schicht 3 (Private Renten, Immobilien & ETFs)</h3>
                     <p>Diese Verträge sind im Alter steuerlich stark begünstigt. Bei einer lebenslangen privaten Rente greift die <strong>Ertragsanteilsbesteuerung</strong> (bei Renteneintritt mit 67 Jahren sind nur 17 % der Rente steuerpflichtig). Depotentnahmen unterliegen der Abgeltungsteuer (25 % zzgl. Soli), wobei Aktien-ETFs eine <strong>Teilfreistellung von 30 %</strong> (komplett steuerfrei) genießen.</p>
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
                     </ul>
                  </div>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">2. Ehegattensplitting</h3>
                     <p className="mb-4">Das deutsche Steuerrecht erlaubt für zusammen veranlagte Ehepaare das Splittingverfahren. Dabei werden die steuerpflichtigen Einkünfte beider Partner (nach Abzug aller Freibeträge) in einen Topf geworfen, addiert und anschließend halbiert. Auf diese eine Hälfte wird der Einkommensteuertarif angewendet. Die daraus resultierende Steuer wird am Ende verdoppelt.</p>
                  </div>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">3. Beamtenpensionen vs. Rente</h3>
                     <p className="mb-2">Die gesetzliche Rente und Basisrenten werden über die nachgelagerte <strong>Kohortenbesteuerung</strong> versteuert. Hier gibt es einen lebenslangen steuerfreien Rentenbetrag (in Euro, nicht in %). Jede spätere Rentenerhöhung wird voll besteuert.</p>
                     <p>Beamtenpensionen unterliegen dagegen als "Einkünfte aus nichtselbstständiger Arbeit" (nach § 19 EStG) der vollen Besteuerung, abzüglich eines <strong>Versorgungsfreibetrags</strong>. Dieser Freibetrag sinkt abhängig vom Jahr des Eintritts in den Ruhestand. Für den Eintrittsjahrgang 2040+ entfällt dieser Freibetrag komplett, sodass die Pension dann voll besteuert wird. Beamte zahlen auf ihre Bezüge zudem keine Arbeitslosen- oder Rentenversicherung und sind meist in der PKV versichert (wodurch keine prozentualen KV/PV-Abzüge in der Rentenphase entstehen).</p>
                  </div>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">4. Krankenversicherung der Rentner (KVdR)</h3>
                     <p>Die KVdR ist keine eigenständige Kasse, sondern ein begehrter Versichertenstatus (9/10-Regelung). Der gravierende Vorteil: KVdR-Mitglieder zahlen KV/PV-Beiträge <strong>nur auf gesetzliche Renten und Betriebsrenten</strong>. Einkünfte aus Kapitalvermögen oder Vermietung bleiben beitragsfrei. Privatversicherte (PKV) sind von dieser Regelung losgelöst und zahlen lediglich ihre individuellen PKV-Prämien.</p>
                  </div>

                  <div className="break-inside-avoid mb-6">
                     <h3 className="font-bold text-lg mb-2 text-indigo-900 border-b border-indigo-100 pb-1">5. Steuerprivilegien in Schicht 3</h3>
                     <p className="mb-2"><strong>Private Leibrenten:</strong> Unterliegen nur der Ertragsanteilsbesteuerung nach § 22 EStG. Geht man mit 67 in Rente, rechnet das Finanzamt fiktiv nur ca. 17 % der Rente als steuerpflichtiges Einkommen an.</p>
                     <p className="mb-2"><strong>Kapitalauszahlungen:</strong> Bei Laufzeiten über 12 Jahren und Auszahlung ab Alter 62 greift das <strong>Halbeinkünfteverfahren</strong>. 50 % des Gewinns sind steuerfrei.</p>
                     <p><strong>ETF-Depots:</strong> Realisierte Kursgewinne unterliegen der Abgeltungsteuer (25 % + Soli). Bei reinen Aktien-ETFs bleiben durch das Investmentsteuergesetz (Teilfreistellung) <strong>30 % aller Gewinne komplett steuerfrei</strong>.</p>
                  </div>
               </>
            )}
          </div>
          <div className="mt-8 text-[10px] text-slate-400 text-center border-t border-slate-200 pt-4 font-semibold uppercase tracking-wider">Hinweis: Alle Berechnungen in diesem Dokument sind softwaregestützte Simulationen und ersetzen keine rechtsverbindliche Steuerberatung. Stand der Steuergesetzgebung: 2026.</div>
        </div>
      )}

    </div>
  );
}