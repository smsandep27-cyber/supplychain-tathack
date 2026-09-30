import React, { useState, useEffect } from 'react';
import {
  Truck,
  Ship,
  Plane,
  Train,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Navigation,
  Zap,
  Globe,
  ArrowRightLeft,
  BarChart3,
  Activity,
  Layers,
  Terminal
} from 'lucide-react';

const RouteRecommender = ({ onNavigate }) => {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');

  const [transportMode, setTransportMode] = useState('any');
  const [routingPolicy, setRoutingPolicy] = useState('STRICT');
  const [operationalConfig, setOperationalConfig] = useState('NORMAL');
  const [cargoType, setCargoType] = useState('general');
  const [priority, setPriority] = useState('normal');

  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState({
    source: '',
    dest: ''
  });

  const [searchResults, setSearchResults] = useState({
    source: [],
    dest: []
  });

  const [scenarios, setScenarios] = useState([]);

  // ============================================================
  // LOAD SCENARIOS
  // ============================================================

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        const res = await fetch('/api/scenarios');

        if (!res.ok) {
          throw new Error(`Scenario API returned ${res.status}`);
        }

        const data = await res.json();

        setScenarios(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load scenarios:', err);
        setScenarios([]);
      }
    };

    loadScenarios();
  }, []);

  // ============================================================
  // SEARCH HUBS
  // ============================================================

  const handleSearch = async (type, query) => {
    setSearchQuery(prev => ({
      ...prev,
      [type]: query
    }));

    // Clear previously selected internal ID
    // when the user changes the text.
    if (type === 'source') {
      setSource('');
    } else {
      setDestination('');
    }

    if (query.trim().length < 2) {
      setSearchResults(prev => ({
        ...prev,
        [type]: []
      }));
      return;
    }

    try {
      const res = await fetch(
        `/api/hubs/search?q=${encodeURIComponent(query.trim())}`
      );

      if (!res.ok) {
        throw new Error(`Hub search returned ${res.status}`);
      }

      const data = await res.json();

      setSearchResults(prev => ({
        ...prev,
        [type]: Array.isArray(data) ? data : []
      }));
    } catch (err) {
      console.error('Hub search failed:', err);

      setSearchResults(prev => ({
        ...prev,
        [type]: []
      }));
    }
  };

  // ============================================================
  // SELECT HUB
  // ============================================================

  const selectHub = (type, hub) => {
    if (!hub?.id) {
      return;
    }

    if (type === 'source') {
      setSource(hub.id);

      setSearchQuery(prev => ({
        ...prev,
        source: hub.display_name || hub.id
      }));
    } else {
      setDestination(hub.id);

      setSearchQuery(prev => ({
        ...prev,
        dest: hub.display_name || hub.id
      }));
    }

    setSearchResults(prev => ({
      ...prev,
      [type]: []
    }));
  };

  // ============================================================
  // RESOLVE HUB FROM TYPED TEXT
  // ============================================================

  const resolveHub = async query => {
    if (!query?.trim()) {
      return null;
    }

    try {
      const res = await fetch(
        `/api/hubs/search?q=${encodeURIComponent(query.trim())}`
      );

      if (!res.ok) {
        return null;
      }

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      const normalizedQuery = query.trim().toLowerCase();

      // Prefer exact ID/display-name/alias matches.
      const exactMatch = data.find(hub => {
        const id = String(hub.id || '').toLowerCase();
        const displayName = String(
          hub.display_name || ''
        ).toLowerCase();

        const aliases = Array.isArray(hub.aliases)
          ? hub.aliases.map(alias =>
            String(alias).toLowerCase()
          )
          : [];

        return (
          id === normalizedQuery ||
          displayName === normalizedQuery ||
          aliases.includes(normalizedQuery)
        );
      });

      // Then prefer partial matches.
      const partialMatch = data.find(hub => {
        const id = String(hub.id || '').toLowerCase();
        const displayName = String(
          hub.display_name || ''
        ).toLowerCase();

        const aliases = Array.isArray(hub.aliases)
          ? hub.aliases.map(alias =>
            String(alias).toLowerCase()
          )
          : [];

        return (
          id.includes(normalizedQuery) ||
          displayName.includes(normalizedQuery) ||
          aliases.some(alias =>
            alias.includes(normalizedQuery)
          )
        );
      });

      return exactMatch || partialMatch || data[0];
    } catch (err) {
      console.error('Hub resolution failed:', err);
      return null;
    }
  };

  // ============================================================
  // GET RECOMMENDATIONS
  // ============================================================

  const getRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      // Always resolve from the visible input fields.
      // This prevents React state timing from causing
      // "valid hub" requests to be rejected.

      const originQuery = searchQuery.source.trim();
      const destinationQuery = searchQuery.dest.trim();

      if (!originQuery || !destinationQuery) {
        throw new Error(
          'Please enter both origin and destination hubs.'
        );
      }

      // ----------------------------------------------------------
      // Resolve origin
      // ----------------------------------------------------------

      const originHub = await resolveHub(originQuery);

      if (!originHub?.id) {
        throw new Error(
          `No origin hub found for "${originQuery}".`
        );
      }

      const resolvedSource = originHub.id;

      // ----------------------------------------------------------
      // Resolve destination
      // ----------------------------------------------------------

      const destinationHub =
        await resolveHub(destinationQuery);

      if (!destinationHub?.id) {
        throw new Error(
          `No destination hub found for "${destinationQuery}".`
        );
      }

      const resolvedDestination =
        destinationHub.id;

      console.log(
        '[ROUTER] Resolved origin:',
        resolvedSource
      );

      console.log(
        '[ROUTER] Resolved destination:',
        resolvedDestination
      );

      // Keep internal state synchronized.
      setSource(resolvedSource);
      setDestination(resolvedDestination);

      // Update visible names to canonical backend names.
      setSearchQuery(prev => ({
        ...prev,
        source:
          originHub.display_name ||
          resolvedSource,
        dest:
          destinationHub.display_name ||
          resolvedDestination
      }));

      // ----------------------------------------------------------
      // Request strategic routes
      // ----------------------------------------------------------

      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: resolvedSource,
          destination: resolvedDestination,
          cargo_type: cargoType,
          priority,
          transport_preference: transportMode,
          routing_policy: routingPolicy,
          scenario:
            operationalConfig !== 'NORMAL'
              ? operationalConfig
              : null,
          overrides: {}
        })
      });

      if (!response.ok) {
        throw new Error(
          `Recommendation API returned ${response.status}`
        );
      }

      const data = await response.json();

      console.log(
        '[ROUTER] Recommendation response:',
        data
      );

      if (data.error) {
        throw new Error(data.error);
      }

      const routes = Array.isArray(
        data.recommendations
      )
        ? data.recommendations
        : [];

      if (routes.length === 0) {
        throw new Error(
          'The routing engine returned no valid recommendations.'
        );
      }

      setRecommendations(routes);
    } catch (err) {
      console.error(
        '[ROUTER] Recommendation failed:',
        err
      );

      setRecommendations([]);

      setError(
        err?.message ||
        'Failed to generate strategic routes.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // MODE ICON
  // ============================================================

  const getModeIcon = (mode = '') => {
    switch (String(mode).toLowerCase()) {
      case 'air':
        return <Plane size={12} />;

      case 'sea':
        return <Ship size={12} />;

      case 'rail':
        return <Train size={12} />;

      case 'road':
        return <Truck size={12} />;

      case 'transfer':
        return <ArrowRightLeft size={12} />;

      default:
        return <Navigation size={12} />;
    }
  };

  // ============================================================
  // NUMBER FORMAT
  // ============================================================

  const formatNumber = value => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return '--';
    }

    return number.toLocaleString();
  };

  // ============================================================
  // ML PREDICTION COMPATIBILITY
  // ============================================================

  const getMLPrediction = recommendation => {
    if (!recommendation) {
      return null;
    }

    return (
      recommendation.ml_prediction ||
      recommendation.ai_prediction ||
      recommendation.delay_prediction ||
      null
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="dashboard-layout">

      {/* ========================================================
          HEADER
      ======================================================== */}

      <header className="dashboard-header">

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <Globe
            size={28}
            color="#3b82f6"
          />

          <div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 800
              }}
            >
              Supplychainer Command Console
            </h1>

            <p
              style={{
                fontSize: '0.7rem',
                color: '#64748b',
                fontWeight: 700
              }}
            >
              UNIFIED MULTIMODAL DECISION SUPERIORITY ENGINE
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem'
          }}
        >
          <button
            className="sc-badge-active"
            onClick={() =>
              onNavigate?.('suppliers')
            }
            style={{
              cursor: 'pointer'
            }}
          >
            <ShieldCheck size={14} />
            SUPPLIER INTELLIGENCE
          </button>
        </div>

      </header>

      {/* ========================================================
          LEFT COMMAND PANEL
      ======================================================== */}

      <aside className="sidebar-left">

        <h2 className="panel-title">
          <Terminal size={14} />
          Strategic Input Panel
        </h2>

        {/* Origin Hub */}
        <div className="sc-input-group">

          <label className="sc-label">
            Origin Hub
          </label>

          <input
            type="text"
            value={searchQuery.source}
            onChange={e =>
              handleSearch(
                'source',
                e.target.value
              )
            }
            className="sc-input"
            placeholder="Search origin..."
          />

          {searchResults.source.length > 0 && (
            <div
              style={{
                background: '#0f172a',
                border:
                  '1px solid #1e293b',
                borderRadius: '4px',
                marginTop: '2px',
                maxHeight: '220px',
                overflowY: 'auto'
              }}
            >
              {searchResults.source.map(
                (hub, idx) => (
                  <button
                    key={`${hub.id}-${idx}`}
                    type="button"
                    onClick={() =>
                      selectHub(
                        'source',
                        hub
                      )
                    }
                    style={{
                      width: '100%',
                      padding: '8px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      color: 'white',
                      borderBottom:
                        '1px solid #1e293b',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    {hub.display_name ||
                      hub.id}
                  </button>
                )
              )}
            </div>
          )}

        </div>

        {/* Destination Hub */}
        <div className="sc-input-group">

          <label className="sc-label">
            Destination Hub
          </label>

          <input
            type="text"
            value={searchQuery.dest}
            onChange={e =>
              handleSearch(
                'dest',
                e.target.value
              )
            }
            className="sc-input"
            placeholder="Search destination..."
          />

          {searchResults.dest.length > 0 && (
            <div
              style={{
                background: '#0f172a',
                border:
                  '1px solid #1e293b',
                borderRadius: '4px',
                marginTop: '2px',
                maxHeight: '220px',
                overflowY: 'auto'
              }}
            >
              {searchResults.dest.map(
                (hub, idx) => (
                  <button
                    key={`${hub.id}-${idx}`}
                    type="button"
                    onClick={() =>
                      selectHub(
                        'dest',
                        hub
                      )
                    }
                    style={{
                      width: '100%',
                      padding: '8px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      color: 'white',
                      borderBottom:
                        '1px solid #1e293b',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    {hub.display_name ||
                      hub.id}
                  </button>
                )
              )}
            </div>
          )}

        </div>

        {/* Transport Mode */}
        <div className="sc-input-group">

          <label className="sc-label">
            Transport Mode
          </label>

          <select
            value={transportMode}
            onChange={e =>
              setTransportMode(
                e.target.value
              )
            }
            className="sc-select"
          >
            <option value="any">
              Unconstrained
            </option>

            <option value="sea">
              SEA (Maritime Corridors)
            </option>

            <option value="air">
              AIR (Express Cargo)
            </option>

            <option value="rail">
              RAIL (Inland Freight)
            </option>

            <option value="road">
              ROAD (Local Distribution)
            </option>
          </select>

        </div>

        {/* Routing Policy */}
        <div className="sc-input-group">

          <label className="sc-label">
            Routing Policy
          </label>

          <select
            value={routingPolicy}
            onChange={e =>
              setRoutingPolicy(
                e.target.value
              )
            }
            className="sc-select"
          >
            <option value="STRICT">
              STRICT (Hard Exclusion)
            </option>

            <option value="PREFERRED">
              PREFERRED (Soft Bias)
            </option>
          </select>

        </div>

        {/* Operational Configuration */}
        <div className="sc-input-group">

          <label className="sc-label">
            Operational Configuration
          </label>

          <select
            value={operationalConfig}
            onChange={e =>
              setOperationalConfig(
                e.target.value
              )
            }
            className="sc-select"
            style={{
              borderColor:
                operationalConfig !==
                  'NORMAL'
                  ? '#ef4444'
                  : '#1e293b'
            }}
          >
            <option value="NORMAL">
              Operational Normal
            </option>

            {scenarios.map(
              scenario => (
                <option
                  key={scenario.id}
                  value={scenario.id}
                >
                  {scenario.name}
                </option>
              )
            )}
          </select>

        </div>

        {/* Strategic Overrides */}
        <div className="sc-input-group">

          <label className="sc-label">
            Strategic Overrides
          </label>

          <div
            style={{
              background:
                'rgba(59, 130, 246, 0.05)',
              padding: '0.75rem',
              borderRadius: '8px',
              border:
                '1px solid #1e293b',
              fontSize: '0.75rem',
              color: '#64748b'
            }}
          >
            Auto-bypass enabled for verified
            chokepoints.
          </div>

        </div>

        {/* Execute */}
        <button
          type="button"
          className="sc-btn-execute"
          onClick={getRecommendations}
          disabled={loading}
        >
          {loading ? (
            <Zap
              className="animate-pulse"
              size={16}
            />
          ) : (
            'GENERATE STRATEGIC ROUTE OPTIONS'
          )}
        </button>

      </aside>

      {/* ========================================================
          MAIN CONTENT
      ======================================================== */}

      <main className="main-content">

        {/* Disruption Banner */}
        {operationalConfig !==
          'NORMAL' && (
            <div className="scenario-banner animate-slide-in">

              <AlertTriangle size={20} />

              <div>

                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    display: 'block'
                  }}
                >
                  ACTIVE GLOBAL DISRUPTION DETECTED
                </span>

                <span
                  style={{
                    fontSize: '0.875rem'
                  }}
                >
                  {(
                    scenarios.find(
                      scenario =>
                        scenario.id ===
                        operationalConfig
                    )?.name
                  ) ||
                    operationalConfig}{' '}
                  logic active in unified solver.
                </span>

              </div>

            </div>
          )}

        {/* Error */}
        {error && (
          <div
            style={{
              color: '#ef4444',
              background:
                'rgba(239, 68, 68, 0.1)',
              padding: '1rem',
              borderRadius: '8px',
              border:
                '1px solid #ef4444',
              marginBottom: '1rem'
            }}
          >
            {error}
          </div>
        )}

        {/* Route Cards */}
        <div className="path-grid">

          {recommendations.map(
            (rec, idx) => (
              <div
                key={`${rec.persona || 'route'}-${idx}`}
                className="path-card"
              >

                {/* Card Header */}
                <div className="card-header">

                  <span
                    className={`persona-badge ${rec.persona ===
                        'FASTEST'
                        ? 'tag-fastest'
                        : rec.persona ===
                          'SAFEST'
                          ? 'tag-safest'
                          : 'tag-balanced'
                      }`}
                  >
                    {rec.persona ||
                      'ROUTE'}
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      alignItems:
                        'center',
                      gap: '4px',
                      fontSize:
                        '0.75rem',
                      fontFamily:
                        'JetBrains Mono'
                    }}
                  >
                    <Clock size={12} />

                    {rec.adjusted_eta ??
                      '--'}
                    h
                  </div>

                </div>

                {/* Route Details */}
                <div
                  style={{
                    padding: '1.25rem'
                  }}
                >

                  <h3
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      marginBottom:
                        '1.5rem'
                    }}
                  >
                    {rec.explanation ||
                      'Recommended multimodal route.'}
                  </h3>

                  {/* Route Legs */}
                  <div
                    style={{
                      display:
                        'flex',
                      flexDirection:
                        'column',
                      gap: '0.75rem',
                      borderLeft:
                        '2px solid #1e293b',
                      paddingLeft:
                        '1rem',
                      marginLeft:
                        '0.5rem'
                    }}
                  >

                    {Array.isArray(
                      rec.legs
                    ) &&
                      rec.legs.map(
                        (
                          leg,
                          legIndex
                        ) => {

                          const isTransfer =
                            leg.type ===
                            'transfer';

                          return (
                            <div
                              key={
                                legIndex
                              }
                              style={{
                                display:
                                  'flex',
                                flexDirection:
                                  'column',
                                opacity:
                                  isTransfer
                                    ? 0.7
                                    : 1
                              }}
                            >

                              <span
                                style={{
                                  fontSize:
                                    '0.65rem',
                                  fontWeight: 800,
                                  color:
                                    isTransfer
                                      ? '#94a3b8'
                                      : '#3b82f6',
                                  letterSpacing:
                                    '0.05em',
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  gap: '4px'
                                }}
                              >

                                {getModeIcon(
                                  leg.mode
                                )}

                                {isTransfer
                                  ? 'STRATEGIC HANDOFF'
                                  : `${String(
                                    leg.mode ||
                                    'TRANSIT'
                                  ).toUpperCase()} TRANSIT`}

                              </span>

                              <span
                                style={{
                                  fontSize:
                                    '0.8rem',
                                  fontWeight:
                                    600
                                }}
                              >
                                {isTransfer
                                  ? `Processing at ${leg.to_name ||
                                  leg.to ||
                                  'hub'
                                  }`
                                  : `to ${leg.to_name ||
                                  leg.to ||
                                  'next hub'
                                  }`}
                              </span>

                              {leg.intel_source && (
                                <span
                                  style={{
                                    marginTop:
                                      '3px',
                                    fontSize:
                                      '0.6rem',
                                    color:
                                      '#64748b'
                                  }}
                                >
                                  INTEL:{' '}
                                  {
                                    leg.intel_source
                                  }
                                </span>
                              )}

                            </div>
                          );
                        }
                      )}

                  </div>

                </div>

                {/* Cost */}
                <div
                  style={{
                    padding:
                      '1.25rem',
                    borderTop:
                      '1px solid #1e293b',
                    background:
                      'rgba(15, 23, 42, 0.3)'
                  }}
                >

                  <div
                    style={{
                      display:
                        'flex',
                      justifyContent:
                        'space-between',
                      fontSize:
                        '0.8rem',
                      fontWeight: 700
                    }}
                  >

                    <span
                      style={{
                        color:
                          '#64748b'
                      }}
                    >
                      TOTAL COST
                    </span>

                    <span
                      style={{
                        color:
                          '#10b981'
                      }}
                    >
                      $
                      {formatNumber(
                        rec.total_cost
                      )}
                    </span>

                  </div>

                </div>

              </div>
            )
          )}

        </div>

      </main>

      {/* ========================================================
          RIGHT INTELLIGENCE PANEL
      ======================================================== */}

      <aside className="sidebar-right">

        <h2 className="panel-title">
          <Layers size={14} />
          Decision Integrity Audit
        </h2>

        {recommendations.length >
          0 ? (

          <div
            style={{
              display:
                'flex',
              flexDirection:
                'column',
              gap: '1rem'
            }}
          >

            {/* AI DELAY INTELLIGENCE */}
            {(() => {
              const prediction =
                getMLPrediction(
                  recommendations[0]
                );

              if (!prediction) {
                return null;
              }

              const predictedDelay =
                prediction.predicted_delay_hours ??
                prediction.delay_hours ??
                prediction.predicted_delay;

              const confidence =
                prediction.confidence;

              return (
                <div
                  className="audit-trace-box"
                  style={{
                    borderLeft:
                      '4px solid #a855f7',
                    background:
                      'rgba(168, 85, 247, 0.06)'
                  }}
                >

                  <div
                    style={{
                      marginBottom:
                        '0.75rem',
                      fontWeight: 700,
                      color:
                        '#f8fafc',
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Activity
                      size={15}
                      color="#a855f7"
                    />

                    AI DELAY INTELLIGENCE
                  </div>

                  <div>
                    Predicted Delay:{' '}
                    <strong>
                      {predictedDelay ??
                        '--'}
                      h
                    </strong>
                  </div>

                  <div>
                    Confidence:{' '}
                    <strong>
                      {confidence != null
                        ? `${(
                          Number(
                            confidence
                          ) * 100
                        ).toFixed(1)}%`
                        : '--'}
                    </strong>
                  </div>

                  {prediction.risk_level && (
                    <div>
                      Risk Level:{' '}
                      <strong>
                        {
                          prediction.risk_level
                        }
                      </strong>
                    </div>
                  )}

                  {prediction.reason && (
                    <div
                      style={{
                        marginTop:
                          '0.5rem',
                        color:
                          '#94a3b8',
                        fontSize:
                          '0.75rem'
                      }}
                    >
                      {
                        prediction.reason
                      }
                    </div>
                  )}

                </div>
              );
            })()}

            {/* FORENSIC ETA */}
            <div
              className="audit-trace-box"
              style={{
                borderLeft:
                  '4px solid #3b82f6'
              }}
            >

              <div
                style={{
                  marginBottom:
                    '0.5rem',
                  fontWeight: 700,
                  color:
                    '#f8fafc'
                }}
              >
                Forensic ETA Audit
              </div>

              <div>
                Transit:{' '}
                {recommendations[0]
                  ?.audit_trace
                  ?.eta
                  ?.transit ??
                  '--'}
                h
              </div>

              <div>
                Transfer: +
                {recommendations[0]
                  ?.audit_trace
                  ?.eta
                  ?.transfer ??
                  0}
                h
              </div>

              <div>
                Scenario Impact:{' '}
                {Number(
                  recommendations[0]
                    ?.audit_trace
                    ?.eta
                    ?.scenario
                ) > 0
                  ? `+${recommendations[0]
                    .audit_trace
                    .eta
                    .scenario
                  }h`
                  : 'None'}
              </div>

            </div>

            {/* COST */}
            <div
              className="audit-trace-box"
              style={{
                borderLeft:
                  '4px solid #10b981'
              }}
            >

              <div
                style={{
                  marginBottom:
                    '0.5rem',
                  fontWeight: 700,
                  color:
                    '#f8fafc'
                }}
              >
                Cost Composition
              </div>

              <div>
                Landed Base: $
                {formatNumber(
                  recommendations[0]
                    ?.audit_trace
                    ?.cost
                    ?.transit
                )}
              </div>

              <div>
                Transfer Fees: $
                {formatNumber(
                  recommendations[0]
                    ?.audit_trace
                    ?.cost
                    ?.transfer
                )}
              </div>

              <div>
                Risk Premium: $
                {formatNumber(
                  recommendations[0]
                    ?.audit_trace
                    ?.cost
                    ?.scenario
                )}
              </div>

            </div>

            {/* STRATEGIC TRUTH */}
            <div
              className="audit-trace-box"
              style={{
                borderLeft:
                  '4px solid #f59e0b'
              }}
            >

              <div
                style={{
                  marginBottom:
                    '0.5rem',
                  fontWeight: 700,
                  color:
                    '#f8fafc'
                }}
              >
                Strategic Truth Anchor
              </div>

              <div>
                Verified against Split-Node
                Forensic Architecture.
                0ms co-location miracles
                detected.
              </div>

            </div>

          </div>

        ) : (

          <div
            style={{
              textAlign:
                'center',
              color:
                '#64748b',
              marginTop:
                '2rem'
            }}
          >

            <Activity
              size={48}
              style={{
                opacity: 0.1,
                marginBottom:
                  '1rem'
              }}
            />

            <p
              style={{
                fontSize:
                  '0.8rem'
              }}
            >
              Awaiting operational
              data stream...
            </p>

          </div>

        )}

        {/* Verification */}
        <div
          style={{
            marginTop:
              'auto'
          }}
        >

          <div
            style={{
              display:
                'flex',
              alignItems:
                'center',
              gap: '0.5rem',
              background:
                'rgba(59, 130, 246, 0.1)',
              padding:
                '0.75rem',
              borderRadius:
                '8px',
              border:
                '1px solid #3b82f6'
            }}
          >

            <ShieldCheck
              size={16}
              color="#3b82f6"
            />

            <span
              style={{
                fontSize:
                  '0.65rem',
                fontWeight:
                  800,
                color:
                  '#3b82f6'
              }}
            >
              TRUTH AUDIT VERIFIED
            </span>

          </div>

        </div>

      </aside>

      {/* ========================================================
          TRADEOFF STRIP
      ======================================================== */}

      <footer className="tradeoff-strip">

        <div
          style={{
            display:
              'flex',
            alignItems:
              'center',
            gap:
              '0.75rem'
          }}
        >

          <BarChart3
            size={20}
            color="#64748b"
          />

          <span
            style={{
              fontSize:
                '0.75rem',
              fontWeight:
                800,
              color:
                '#64748b'
            }}
          >
            TRADEOFF ANALYSIS
          </span>

        </div>

        <div
          style={{
            display:
              'flex',
            gap:
              '3rem',
            flex:
              1,
            justifyContent:
              'center'
          }}
        >

          {/* Speed */}
          <div
            style={{
              display:
                'flex',
              gap:
                '0.5rem',
              alignItems:
                'center'
            }}
          >

            <span
              style={{
                fontSize:
                  '0.7rem',
                fontWeight:
                  700,
                color:
                  '#94a3b8'
              }}
            >
              OPTIMAL SPEED:
            </span>

            <span
              style={{
                fontSize:
                  '0.9rem',
                fontWeight:
                  800,
                color:
                  '#f59e0b'
              }}
            >
              {recommendations[0]
                ?.adjusted_eta ??
                '--'}
              h
            </span>

          </div>

          {/* Cost */}
          <div
            style={{
              display:
                'flex',
              gap:
                '0.5rem',
              alignItems:
                'center'
            }}
          >

            <span
              style={{
                fontSize:
                  '0.7rem',
                fontWeight:
                  700,
                color:
                  '#94a3b8'
              }}
            >
              LOWEST COST:
            </span>

            <span
              style={{
                fontSize:
                  '0.9rem',
                fontWeight:
                  800,
                color:
                  '#10b981'
              }}
            >
              $
              {recommendations.length >
                0
                ? Math.min(
                  ...recommendations.map(
                    route =>
                      Number(
                        route.total_cost
                      ) ||
                      Infinity
                  )
                ).toLocaleString()
                : '--'}
            </span>

          </div>

          {/* Risk */}
          <div
            style={{
              display:
                'flex',
              gap:
                '0.5rem',
              alignItems:
                'center'
            }}
          >

            <span
              style={{
                fontSize:
                  '0.7rem',
                fontWeight:
                  700,
                color:
                  '#94a3b8'
              }}
            >
              RISK FLOOR:
            </span>

            <span
              style={{
                fontSize:
                  '0.9rem',
                fontWeight:
                  800,
                color:
                  '#3b82f6'
              }}
            >
              {recommendations.length >
                0
                ? Math.min(
                  ...recommendations.map(
                    route =>
                      (Number(
                        route.threat_level
                      ) || 0) *
                      100
                  )
                )
                : '--'}
              %
            </span>

          </div>

        </div>

      </footer>

    </div>
  );
};

export default RouteRecommender;
