import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Save, Download, Trash2, Plus, Edit2, ChevronDown, ChevronUp, TrendingUp, DollarSign, Target, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/firebase';
import { generateInvestmentPDF } from '../lib/generateInvestmentPDF';
import { collection, doc, setDoc, getDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';

// Types
interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
}

interface UseOfFundsItem {
  id: string;
  category: string;
  amount: number;
  description: string;
  expectedOutcome: string;
}

interface RiskItem {
  id: string;
  risk: string;
  mitigation: string;
  probability: 'high' | 'medium' | 'low';
}

interface InvestmentPitch {
  id?: string;
  companyId: string;
  companyName: string;
  currentARR: number;
  currentMargin: number;
  
  // Problem & Solution
  problemStatement: string;
  solutionStatement: string;
  differentiator: string;
  whyNow: string;
  
  // Elevator Pitch
  elevatorPitch: string;
  
  // Market
  targetMarket: string;
  tam: number;
  sam: number;
  som: number;
  
  // Financial Ask
  askingAmount: number;
  runway: number;
  projectedYear1Revenue: number;
  projectedYear2Revenue: number;
  projectedYear3Revenue: number;
  
  // Use of Funds
  useOfFunds: UseOfFundsItem[];
  
  // Team
  team: TeamMember[];
  
  // Risks
  risks: RiskItem[];
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
}

const InvestmentPitch: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const [pitches, setPitches] = useState<InvestmentPitch[]>([]);
  const [currentPitch, setCurrentPitch] = useState<InvestmentPitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'list' | 'editor' | 'preview'>('list');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Check if in frame mode
  const isFrameMode = new URLSearchParams(window.location.search).get('mode') === 'frame';

  // Load pitches from Firebase
  useEffect(() => {
    if (!user || !selectedCompany) return;

    const loadPitches = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'investmentPitches'),
          where('companyId', '==', selectedCompany.id)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as InvestmentPitch[];
        setPitches(data);

        // If in frame mode, automatically show the most recent pitch in preview
        if (isFrameMode && data.length > 0) {
          const mostRecent = data.sort((a, b) =>
            (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
          )[0];
          setCurrentPitch(mostRecent);
          setView('preview');
        }
      } catch (error) {
        console.error('Error loading pitches:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPitches();
  }, [user, selectedCompany, isFrameMode]);

  // Initialize new pitch
  const createNewPitch = () => {
    const newPitch: InvestmentPitch = {
      companyId: selectedCompany?.id || '',
      companyName: selectedCompany?.name || '',
      currentARR: 480000, // Example
      currentMargin: 16.2,
      
      problemStatement: '',
      solutionStatement: '',
      differentiator: '',
      whyNow: '',
      elevatorPitch: '',
      
      targetMarket: '',
      tam: 0,
      sam: 0,
      som: 0,
      
      askingAmount: 100000,
      runway: 12,
      projectedYear1Revenue: 1200000,
      projectedYear2Revenue: 2800000,
      projectedYear3Revenue: 4500000,
      
      useOfFunds: [],
      team: [],
      risks: [],
      
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    setCurrentPitch(newPitch);
    setView('editor');
  };

  // Save pitch to Firebase
  const savePitch = async () => {
    if (!user || !currentPitch) return;

    try {
      setSaving(true);
      const pitchId = currentPitch.id || `pitch_${Date.now()}`;
      const docRef = doc(db, 'investmentPitches', pitchId);
      
      await setDoc(docRef, {
        ...currentPitch,
        id: pitchId,
        updatedAt: new Date(),
      });

      // Update local state
      const updatedPitch = { ...currentPitch, id: pitchId };
      setPitches(prev => {
        const exists = prev.find(p => p.id === pitchId);
        if (exists) {
          return prev.map(p => p.id === pitchId ? updatedPitch : p);
        }
        return [...prev, updatedPitch];
      });
      setCurrentPitch(updatedPitch);
      setView('preview');
    } catch (error) {
      console.error('Error saving pitch:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete pitch
  const deletePitch = async (pitchId: string) => {
    if (!confirm('Zeker dat je deze pitch wilt verwijderen?')) return;

    try {
      await deleteDoc(doc(db, 'investmentPitches', pitchId));
      setPitches(prev => prev.filter(p => p.id !== pitchId));
      if (currentPitch?.id === pitchId) {
        setCurrentPitch(null);
        setView('list');
      }
    } catch (error) {
      console.error('Error deleting pitch:', error);
    }
  };

  // Toggle section expand
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Calculate metrics
  const calculateMetrics = () => {
    if (!currentPitch) return null;

    const investment = currentPitch.askingAmount;
    const year1Revenue = currentPitch.projectedYear1Revenue;
    const year3Revenue = currentPitch.projectedYear3Revenue;
    
    const year1Profit = year1Revenue * 0.20; // Assuming 20% margin year 1
    const roi3Year = ((year3Revenue * 0.25 * 3 - investment) / investment) * 100;
    
    const breakEvenMonths = investment / (year1Revenue / 12) * 0.7; // Rough estimate
    
    return {
      investment,
      year1Revenue,
      year1Profit,
      roi3Year,
      breakEvenMonths: Math.round(breakEvenMonths),
      paybackPeriod: Math.round(investment / (year1Profit / 12)),
    };
  };

  // Revenue projection data
  const getRevenueProjection = () => {
    if (!currentPitch) return [];
    
    return [
      { year: 'Now', revenue: currentPitch.currentARR, type: 'Actual' },
      { year: 'Year 1', revenue: currentPitch.projectedYear1Revenue, type: 'Projected' },
      { year: 'Year 2', revenue: currentPitch.projectedYear2Revenue, type: 'Projected' },
      { year: 'Year 3', revenue: currentPitch.projectedYear3Revenue, type: 'Projected' },
    ];
  };

  // Use of Funds chart data
  const getUoFData = () => {
    if (!currentPitch || currentPitch.useOfFunds.length === 0) return [];
    return currentPitch.useOfFunds.map(item => ({
      name: item.category,
      value: item.amount,
    }));
  };

  const colors = ['#1e3a8a', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
  const metrics = calculateMetrics();

  // ========== VIEWS ==========

  if (loading) {
    return <div className="p-8 text-center">Bezig met laden...</div>;
  }

  // If no pitches exist and in frame mode, show message
  if (isFrameMode && pitches.length === 0) {
    return (
      <div className="p-8 text-center">
        <Target className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-300">Geen pitch decks beschikbaar</p>
      </div>
    );
  }

  // LIST VIEW
  if (view === 'list') {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">💼 Investment Pitch Decks</h1>
          <button
            onClick={createNewPitch}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-5 w-5" />
            Nieuwe Pitch
          </button>
        </div>

        {pitches.length === 0 ? (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-300 mb-4">Geen pitch decks gevonden</p>
            <button
              onClick={createNewPitch}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Maak je eerste pitch
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {pitches.map(pitch => (
              <div key={pitch.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{pitch.companyName}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{pitch.elevatorPitch}</p>
                    <div className="flex gap-4 mt-3 text-sm">
                      <span className="text-primary-600 font-semibold">Ask: €{(pitch.askingAmount / 1000).toFixed(0)}k</span>
                      <span className="text-gray-500 dark:text-gray-300">ARR: €{(pitch.currentARR / 1000).toFixed(0)}k</span>
                      <span className="text-gray-500 dark:text-gray-300">Updated: {pitch.updatedAt?.toLocaleDateString('nl-NL')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setCurrentPitch(pitch);
                        setView('preview');
                      }}
                      className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPitch(pitch);
                        setView('editor');
                      }}
                      className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => pitch.id && deletePitch(pitch.id)}
                      className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // EDITOR VIEW
  if (view === 'editor' && currentPitch) {
    return (
      <div className="p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit: {currentPitch.companyName}</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setView('preview')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900"
            >
              Preview
            </button>
            <button
              onClick={savePitch}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Problem & Solution */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">🎯 Problem Statement</h2>
              <textarea
                value={currentPitch.problemStatement}
                onChange={(e) => setCurrentPitch({ ...currentPitch, problemStatement: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Welk probleem los je op? Wees specifiek en data-driven."
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">💡 Solution Statement</h2>
              <textarea
                value={currentPitch.solutionStatement}
                onChange={(e) => setCurrentPitch({ ...currentPitch, solutionStatement: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Hoe los je het op? Wat maakt je uniek en waarom nu?"
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">⚡ Differentiator</h2>
              <textarea
                value={currentPitch.differentiator}
                onChange={(e) => setCurrentPitch({ ...currentPitch, differentiator: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Waarom jij en niet de concurrent? Unique value proposition."
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">Elevator Pitch (30 sec)</h2>
              <textarea
                value={currentPitch.elevatorPitch}
                onChange={(e) => setCurrentPitch({ ...currentPitch, elevatorPitch: e.target.value })}
                rows={3}
                maxLength={280}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">{currentPitch.elevatorPitch.length}/280</p>
            </div>
          </div>

          {/* Market & Financials */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">🌍 Market Opportunity</h2>
              <input
                type="text"
                value={currentPitch.targetMarket}
                onChange={(e) => setCurrentPitch({ ...currentPitch, targetMarket: e.target.value })}
                placeholder="Target Market"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-3"
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">TAM €</label>
                  <input
                    type="number"
                    value={currentPitch.tam}
                    onChange={(e) => setCurrentPitch({ ...currentPitch, tam: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">SAM €</label>
                  <input
                    type="number"
                    value={currentPitch.sam}
                    onChange={(e) => setCurrentPitch({ ...currentPitch, sam: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">SOM €</label>
                  <input
                    type="number"
                    value={currentPitch.som}
                    onChange={(e) => setCurrentPitch({ ...currentPitch, som: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">💰 Investment Ask</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Amount €</label>
                  <input
                    type="number"
                    value={currentPitch.askingAmount}
                    onChange={(e) => setCurrentPitch({ ...currentPitch, askingAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Runway (months)</label>
                  <input
                    type="number"
                    value={currentPitch.runway}
                    onChange={(e) => setCurrentPitch({ ...currentPitch, runway: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">📊 Revenue Projections</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Year 1 Revenue €</label>
                  <input
                    type="number"
                    value={currentPitch.projectedYear1Revenue}
                    onChange={(e) => setCurrentPitch({ ...currentPitch, projectedYear1Revenue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Year 2 Revenue €</label>
                  <input
                    type="number"
                    value={currentPitch.projectedYear2Revenue}
                    onChange={(e) => setCurrentPitch({ ...currentPitch, projectedYear2Revenue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Year 3 Revenue €</label>
                  <input
                    type="number"
                    value={currentPitch.projectedYear3Revenue}
                    onChange={(e) => setCurrentPitch({ ...currentPitch, projectedYear3Revenue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Use of Funds */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">💸 Use of Funds</h2>
            <button
              onClick={() => setCurrentPitch({
                ...currentPitch,
                useOfFunds: [...currentPitch.useOfFunds, { id: Date.now().toString(), category: '', amount: 0, description: '', expectedOutcome: '' }]
              })}
              className="text-primary-600 text-sm hover:text-primary-700"
            >
              + Add Item
            </button>
          </div>
          <div className="space-y-3">
            {currentPitch.useOfFunds.map((item, idx) => (
              <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={item.category}
                    onChange={(e) => {
                      const updated = [...currentPitch.useOfFunds];
                      updated[idx].category = e.target.value;
                      setCurrentPitch({ ...currentPitch, useOfFunds: updated });
                    }}
                    placeholder="Category"
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) => {
                      const updated = [...currentPitch.useOfFunds];
                      updated[idx].amount = Number(e.target.value);
                      setCurrentPitch({ ...currentPitch, useOfFunds: updated });
                    }}
                    placeholder="€"
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                  <button
                    onClick={() => {
                      const updated = currentPitch.useOfFunds.filter((_, i) => i !== idx);
                      setCurrentPitch({ ...currentPitch, useOfFunds: updated });
                    }}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => {
                    const updated = [...currentPitch.useOfFunds];
                    updated[idx].description = e.target.value;
                    setCurrentPitch({ ...currentPitch, useOfFunds: updated });
                  }}
                  placeholder="What will this fund?"
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                />
                <input
                  type="text"
                  value={item.expectedOutcome}
                  onChange={(e) => {
                    const updated = [...currentPitch.useOfFunds];
                    updated[idx].expectedOutcome = e.target.value;
                    setCurrentPitch({ ...currentPitch, useOfFunds: updated });
                  }}
                  placeholder="Expected outcome (e.g., +€500k revenue)"
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">👥 Team</h2>
            <button
              onClick={() => setCurrentPitch({
                ...currentPitch,
                team: [...currentPitch.team, { id: Date.now().toString(), name: '', role: '', bio: '' }]
              })}
              className="text-primary-600 text-sm hover:text-primary-700"
            >
              + Add Member
            </button>
          </div>
          <div className="space-y-3">
            {currentPitch.team.map((member, idx) => (
              <div key={member.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => {
                      const updated = [...currentPitch.team];
                      updated[idx].name = e.target.value;
                      setCurrentPitch({ ...currentPitch, team: updated });
                    }}
                    placeholder="Name"
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                  <input
                    type="text"
                    value={member.role}
                    onChange={(e) => {
                      const updated = [...currentPitch.team];
                      updated[idx].role = e.target.value;
                      setCurrentPitch({ ...currentPitch, team: updated });
                    }}
                    placeholder="Role"
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                </div>
                <textarea
                  value={member.bio}
                  onChange={(e) => {
                    const updated = [...currentPitch.team];
                    updated[idx].bio = e.target.value;
                    setCurrentPitch({ ...currentPitch, team: updated });
                  }}
                  placeholder="Bio / Background"
                  rows={2}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Risks */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">⚠️ Risks & Mitigations</h2>
            <button
              onClick={() => setCurrentPitch({
                ...currentPitch,
                risks: [...currentPitch.risks, { id: Date.now().toString(), risk: '', mitigation: '', probability: 'medium' }]
              })}
              className="text-primary-600 text-sm hover:text-primary-700"
            >
              + Add Risk
            </button>
          </div>
          <div className="space-y-3">
            {currentPitch.risks.map((item, idx) => (
              <div key={item.id} className="p-4 bg-red-50 rounded-lg space-y-2">
                <input
                  type="text"
                  value={item.risk}
                  onChange={(e) => {
                    const updated = [...currentPitch.risks];
                    updated[idx].risk = e.target.value;
                    setCurrentPitch({ ...currentPitch, risks: updated });
                  }}
                  placeholder="What could go wrong?"
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                />
                <input
                  type="text"
                  value={item.mitigation}
                  onChange={(e) => {
                    const updated = [...currentPitch.risks];
                    updated[idx].mitigation = e.target.value;
                    setCurrentPitch({ ...currentPitch, risks: updated });
                  }}
                  placeholder="How will we mitigate this?"
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                />
                <select
                  value={item.probability}
                  onChange={(e) => {
                    const updated = [...currentPitch.risks];
                    updated[idx].probability = e.target.value as 'high' | 'medium' | 'low';
                    setCurrentPitch({ ...currentPitch, risks: updated });
                  }}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                >
                  <option value="low">Low Probability</option>
                  <option value="medium">Medium Probability</option>
                  <option value="high">High Probability</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // PREVIEW VIEW
  if (view === 'preview' && currentPitch && metrics) {
    return (
      <div className={isFrameMode ? "space-y-6 p-4" : "p-8 space-y-8 max-w-7xl mx-auto"}>
        {!isFrameMode && (
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{currentPitch.companyName}</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setView('editor')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => generateInvestmentPDF({
    companyName: currentPitch.companyName,
    elevatorPitch: currentPitch.elevatorPitch,
    currentARR: currentPitch.currentARR,
    currentMargin: currentPitch.currentMargin,
    problemStatement: currentPitch.problemStatement,
    solutionStatement: currentPitch.solutionStatement,
    differentiator: currentPitch.differentiator,
    targetMarket: currentPitch.targetMarket,
    tam: currentPitch.tam,
    sam: currentPitch.sam,
    som: currentPitch.som,
    askingAmount: currentPitch.askingAmount,
    runway: currentPitch.runway,
    projectedYear1Revenue: currentPitch.projectedYear1Revenue,
    projectedYear2Revenue: currentPitch.projectedYear2Revenue,
    projectedYear3Revenue: currentPitch.projectedYear3Revenue,
  })}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Download className="h-4 w-4" />
                PDF Download
              </button>
            </div>
          </div>
        )}

        {isFrameMode && currentPitch.companyName && (
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{currentPitch.companyName}</h1>
          </div>
        )}

        {/* Executive Summary */}
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white rounded-lg p-8">
          <p className="text-primary-200 text-sm font-semibold mb-2">EXECUTIVE SUMMARY</p>
          <h2 className="text-3xl font-bold mb-4">{currentPitch.elevatorPitch}</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            <div>
              <p className="text-primary-200 text-sm mb-1">Investment Ask</p>
              <p className="text-3xl font-bold">€{(metrics.investment / 1000).toFixed(0)}k</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm mb-1">Year 1 Revenue</p>
              <p className="text-3xl font-bold">€{(metrics.year1Revenue / 1000000).toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm mb-1">3-Year ROI</p>
              <p className="text-3xl font-bold">{metrics.roi3Year.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm mb-1">Break-Even</p>
              <p className="text-3xl font-bold">{metrics.breakEvenMonths} mo</p>
            </div>
          </div>
        </div>

        {/* Problem & Solution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">🎯 The Problem</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{currentPitch.problemStatement}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">💡 Our Solution</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{currentPitch.solutionStatement}</p>
            <div className="mt-4 p-3 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-900 font-semibold">{currentPitch.differentiator}</p>
            </div>
          </div>
        </div>

        {/* Revenue Projection */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">📈 Revenue Projection</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={getRevenueProjection()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(value) => `€${(value / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(value) => `€${(value / 1000000).toFixed(2)}M`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#1e3a8a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
            <p className="text-sm text-green-900">
              <strong>Growth Strategy:</strong> From €{(currentPitch.currentARR / 1000).toFixed(0)}k ARR today to €{(currentPitch.projectedYear3Revenue / 1000000).toFixed(1)}M in Year 3.
              With €{(metrics.investment / 1000).toFixed(0)}k investment, we achieve {metrics.roi3Year.toFixed(0)}% ROI.
            </p>
          </div>
        </div>

        {/* Use of Funds */}
        {currentPitch.useOfFunds.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">💸 Use of Funds - Allocation</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={getUoFData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${((value / metrics.investment) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {currentPitch.useOfFunds.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Expected Outcomes</h2>
              <div className="space-y-4">
                {currentPitch.useOfFunds.map((item, idx) => (
                  <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-l-4" style={{ borderColor: colors[idx % colors.length] }}>
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{item.category}</h3>
                      <span className="text-lg font-bold text-primary-600">€{(item.amount / 1000).toFixed(0)}k</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{item.description}</p>
                    <p className="text-sm font-semibold text-green-700 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      {item.expectedOutcome}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Market Opportunity */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">🌍 Market Opportunity</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{currentPitch.targetMarket}</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">TAM</p>
              <p className="text-2xl font-bold text-blue-600">€{(currentPitch.tam / 1000000).toFixed(0)}M</p>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">Total Addressable</p>
            </div>
            <div className="p-4 bg-cyan-50 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">SAM</p>
              <p className="text-2xl font-bold text-cyan-600">€{(currentPitch.sam / 1000000).toFixed(0)}M</p>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">Serviceable</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">SOM</p>
              <p className="text-2xl font-bold text-green-600">€{(currentPitch.som / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">Obtainable (5yr)</p>
            </div>
          </div>
        </div>

        {/* Team */}
        {currentPitch.team.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">👥 Leadership Team</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentPitch.team.map(member => (
                <div key={member.id} className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">{member.name}</h3>
                  <p className="text-sm font-semibold text-primary-600 mb-2">{member.role}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{member.bio}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risks */}
        {currentPitch.risks.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">⚠️ Risk Mitigation Strategy</h2>
            <div className="space-y-3">
              {currentPitch.risks.map(risk => (
                <div key={risk.id} className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{risk.risk}</h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1"><strong>Mitigation:</strong> {risk.mitigation}</p>
                      <span className={`text-xs font-semibold mt-2 inline-block px-2 py-1 rounded ${ risk.probability === 'high' ? 'bg-red-200 text-red-800' : risk.probability === 'medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800' }`}>
                        {risk.probability.charAt(0).toUpperCase() + risk.probability.slice(1)} Probability
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-300">Investment Pitch Deck | {currentPitch.companyName} | {new Date().toLocaleDateString('nl-NL')}</p>
        </div>
      </div>
    );
  }

  return null;
};

// PDF Generation Function
const generatePDF = (pitch: InvestmentPitch) => {
  const metrics = calculateMetricsStatic(pitch);
  const totalUoF = pitch.useOfFunds.reduce((sum, item) => sum + item.amount, 0);

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>Investment Pitch - ${pitch.companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    
    .page { page-break-after: always; padding: 50px 40px; }
    
    /* Cover */
    .cover { background: linear-gradient(135deg, #1e3a8a 0%, #312e81 100%); color: white; display: flex; flex-direction: column; justify-content: space-between; min-height: 100vh; padding: 80px 60px; }
    .cover h1 { font-size: 56px; font-weight: 700; margin-bottom: 20px; }
    .cover p { font-size: 22px; color: #e0e7ff; margin-bottom: 80px; line-height: 1.5; }
    .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 60px; }
    .metric { }
    .metric-value { font-size: 42px; font-weight: 700; margin-bottom: 8px; }
    .metric-label { font-size: 14px; color: #c7d2fe; }
    
    /* Content */
    h2 { font-size: 32px; font-weight: 700; color: #1e3a8a; margin-bottom: 24px; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-top: 0; }
    h3 { font-size: 18px; font-weight: 600; color: #374151; margin-top: 16px; margin-bottom: 12px; }
    p { margin-bottom: 12px; line-height: 1.7; }
    
    .box { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e5e7eb; }
    
    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; color: #1f2937; }
    
    /* Sections */
    .section { margin-bottom: 48px; }
    
    .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    
    .highlight { background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 16px; }
  </style>
</head>
<body>

<!-- COVER PAGE -->
<div class="page cover">
  <div>
    <h1>${pitch.companyName}</h1>
    <p>${pitch.elevatorPitch}</p>
  </div>
  
  <div class="metrics-grid">
    <div class="metric">
      <div class="metric-value">€${(metrics.investment / 1000).toFixed(0)}k</div>
      <div class="metric-label">Investment Ask</div>
    </div>
    <div class="metric">
      <div class="metric-value">€${(metrics.year1Revenue / 1000000).toFixed(1)}M</div>
      <div class="metric-label">Year 1 Revenue</div>
    </div>
    <div class="metric">
      <div class="metric-value">${metrics.roi3Year.toFixed(0)}%</div>
      <div class="metric-label">3-Year ROI</div>
    </div>
    <div class="metric">
      <div class="metric-value">${metrics.breakEvenMonths} mo</div>
      <div class="metric-label">Break-Even</div>
    </div>
  </div>
  
  <div class="footer">
    Generated from AlloonApp | ${new Date().toLocaleDateString('nl-NL')}
  </div>
</div>

<!-- PROBLEM & SOLUTION -->
<div class="page">
  <div class="section">
    <h2>🎯 The Problem</h2>
    <div class="box">
      ${pitch.problemStatement}
    </div>
  </div>
  
  <div class="section">
    <h2>💡 Our Solution</h2>
    <div class="box">
      ${pitch.solutionStatement}
    </div>
    <h3>Why Us? Differentiator</h3>
    <div class="box">
      ${pitch.differentiator}
    </div>
  </div>
</div>

<!-- TRACTION & FINANCIALS -->
<div class="page">
  <div class="section">
    <h2>📊 Current Traction & Market Position</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Current ARR</td>
        <td><strong>€${(pitch.currentARR / 1000).toFixed(0)}k</strong></td>
      </tr>
      <tr>
        <td>Current Margin</td>
        <td><strong>${pitch.currentMargin.toFixed(1)}%</strong></td>
      </tr>
      <tr>
        <td>Market: ${pitch.targetMarket}</td>
        <td><strong>TAM: €${(pitch.tam / 1000000).toFixed(0)}M</strong></td>
      </tr>
    </table>
  </div>
  
  <div class="section">
    <h2>📈 Financial Projections & ROI</h2>
    <div class="highlight">
      <strong>Investment Thesis:</strong> With €${(metrics.investment / 1000).toFixed(0)}k, we achieve €${(metrics.year1Revenue / 1000000).toFixed(1)}M revenue in Year 1,
      representing a <strong>${metrics.roi3Year.toFixed(0)}% 3-year ROI</strong>. Break-even in <strong>${metrics.breakEvenMonths} months</strong>.
    </div>
    
    <table>
      <tr>
        <th>Period</th>
        <th>Revenue</th>
        <th>Growth</th>
      </tr>
      <tr>
        <td>Current</td>
        <td>€${(pitch.currentARR / 1000).toFixed(0)}k</td>
        <td>Baseline</td>
      </tr>
      <tr>
        <td>Year 1</td>
        <td>€${(pitch.projectedYear1Revenue / 1000000).toFixed(1)}M</td>
        <td>+${(((pitch.projectedYear1Revenue - pitch.currentARR) / pitch.currentARR) * 100).toFixed(0)}%</td>
      </tr>
      <tr>
        <td>Year 2</td>
        <td>€${(pitch.projectedYear2Revenue / 1000000).toFixed(1)}M</td>
        <td>+${(((pitch.projectedYear2Revenue - pitch.projectedYear1Revenue) / pitch.projectedYear1Revenue) * 100).toFixed(0)}%</td>
      </tr>
      <tr>
        <td>Year 3</td>
        <td>€${(pitch.projectedYear3Revenue / 1000000).toFixed(1)}M</td>
        <td>+${(((pitch.projectedYear3Revenue - pitch.projectedYear2Revenue) / pitch.projectedYear2Revenue) * 100).toFixed(0)}%</td>
      </tr>
    </table>
  </div>
</div>

<!-- USE OF FUNDS -->
<div class="page">
  <div class="section">
    <h2>💸 Use of Funds - Strategic Allocation</h2>
    <table>
      <tr>
        <th>Category</th>
        <th>Amount</th>
        <th>%</th>
        <th>Expected Outcome</th>
      </tr>
      ${pitch.useOfFunds.map(item => `
        <tr>
          <td><strong>${item.category}</strong></td>
          <td>€${(item.amount / 1000).toFixed(0)}k</td>
          <td>${((item.amount / totalUoF) * 100).toFixed(0)}%</td>
          <td>${item.expectedOutcome}</td>
        </tr>
      `).join('')}
    </table>
  </div>
</div>

<!-- MARKET -->
<div class="page">
  <div class="section">
    <h2>🌍 Market Opportunity (TAM/SAM/SOM)</h2>
    <p>${pitch.targetMarket}</p>
    <table>
      <tr>
        <th>Market Segment</th>
        <th>Value</th>
        <th>Description</th>
      </tr>
      <tr>
        <td><strong>TAM</strong></td>
        <td><strong>€${(pitch.tam / 1000000).toFixed(0)}M</strong></td>
        <td>Total Addressable Market</td>
      </tr>
      <tr>
        <td><strong>SAM</strong></td>
        <td><strong>€${(pitch.sam / 1000000).toFixed(0)}M</strong></td>
        <td>Serviceable Addressable Market</td>
      </tr>
      <tr>
        <td><strong>SOM</strong></td>
        <td><strong>€${(pitch.som / 1000000).toFixed(1)}M</strong></td>
        <td>Serviceable Obtainable Market (5yr target)</td>
      </tr>
    </table>
  </div>
</div>

${pitch.team.length > 0 ? `
<!-- TEAM -->
<div class="page">
  <div class="section">
    <h2>👥 Leadership Team</h2>
    ${pitch.team.map(member => `
      <div style="margin-bottom: 24px;">
        <h3>${member.name}</h3>
        <p><strong>${member.role}</strong></p>
        <div class="box">${member.bio}</div>
      </div>
    `).join('')}
  </div>
</div>
` : ''}

${pitch.risks.length > 0 ? `
<!-- RISKS -->
<div class="page">
  <div class="section">
    <h2>⚠️ Risk Mitigation Strategy</h2>
    ${pitch.risks.map(risk => `
      <div style="margin-bottom: 24px; padding: 16px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px;">
        <h3 style="color: #991b1b; margin-top: 0;">Risk: ${risk.risk}</h3>
        <p><strong>Mitigation:</strong> ${risk.mitigation}</p>
        <p style="font-size: 12px; color: #7f1d1d; margin-bottom: 0;">Probability: <strong>${risk.probability.toUpperCase()}</strong></p>
      </div>
    `).join('')}
  </div>
</div>
` : ''}

</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Pitch-${pitch.companyName?.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Helper function for metrics calculation
const calculateMetricsStatic = (pitch: InvestmentPitch) => {
  const investment = pitch.askingAmount;
  const year1Revenue = pitch.projectedYear1Revenue;
  const year3Revenue = pitch.projectedYear3Revenue;
  
  const year1Profit = year1Revenue * 0.20;
  const roi3Year = ((year3Revenue * 0.25 * 3 - investment) / investment) * 100;
  const breakEvenMonths = Math.round((investment / (year1Revenue / 12)) * 0.7);
  
  return {
    investment,
    year1Revenue,
    year1Profit,
    roi3Year,
    breakEvenMonths,
  };
};

export default InvestmentPitch;