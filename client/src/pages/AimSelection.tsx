import React, { useState } from 'react';
import { apiUrl } from "@/lib/queryClient";

const AimSelection = () => {
    const [selectedAim, setSelectedAim] = useState('');
    const [loading, setLoading] = useState(false);

    const aims = [
        { id: 'ias', label: '🎓 IAS / UPSC', color: '#f59e0b', bg: 'linear-gradient(135deg, #1a1200, #2d1f00)' },
        { id: 'doctor', label: '👨‍⚕️ Doctor / Medical', color: '#10b981', bg: 'linear-gradient(135deg, #001a0f, #002d1a)' },
        { id: 'engineer', label: '💻 Engineer / Coding', color: '#3b82f6', bg: 'linear-gradient(135deg, #00102d, #001a4d)' },
        { id: 'teacher', label: '👨‍🏫 Teacher', color: '#a78bfa', bg: 'linear-gradient(135deg, #0d0020, #1a0035)' },
        { id: 'business', label: '📈 Business', color: '#f43f5e', bg: 'linear-gradient(135deg, #200010, #3d001f)' },
        { id: 'vfx', label: '🎨 VFX & Animation', color: '#ec4899', bg: 'linear-gradient(135deg, #1f0015, #3d0028)' },
        { id: 'fitness', label: '🏋️ Fitness', color: '#f97316', bg: 'linear-gradient(135deg, #1f0a00, #3d1500)' },
        { id: 'reading', label: '📚 General Learning', color: '#06b6d4', bg: 'linear-gradient(135deg, #00101a, #001f33)' },
        { id: 'law', label: '⚖️ Law / LLB', color: '#eab308', bg: 'linear-gradient(135deg, #1a1500, #2d2300)' },
        { id: 'ca', label: '💼 CA / Finance', color: '#22c55e', bg: 'linear-gradient(135deg, #001500, #002800)' },
        { id: 'design', label: '🖌️ UI/UX Design', color: '#e879f9', bg: 'linear-gradient(135deg, #1a0020, #2d003d)' },
        { id: 'music', label: '🎵 Music / Artist', color: '#f472b6', bg: 'linear-gradient(135deg, #200015, #3d0028)' },
        { id: 'sports', label: '⚽ Sports / Athlete', color: '#84cc16', bg: 'linear-gradient(135deg, #0a1500, #162800)' },
        { id: 'neet', label: '🧬 NEET Prep', color: '#2dd4bf', bg: 'linear-gradient(135deg, #001a18, #002d29)' },
        { id: 'defense', label: '🪖 Army / Defense', color: '#a3e635', bg: 'linear-gradient(135deg, #0d1500, #1a2800)' },
        { id: 'content', label: '📱 Content Creator', color: '#fb923c', bg: 'linear-gradient(135deg, #200a00, #3d1500)' },
        { id: 'aviation', label: '✈️ Pilot / Aviation', color: '#38bdf8', bg: 'linear-gradient(135deg, #00131a, #002033)' },
        { id: 'police', label: '👮 Police / SSC', color: '#facc15', bg: 'linear-gradient(135deg, #1a1400, #2d2200)' },
        { id: 'pharmacy', label: '💊 Pharmacy', color: '#4ade80', bg: 'linear-gradient(135deg, #001200, #002200)' },
        { id: 'acting', label: '🎭 Acting / Drama', color: '#fb7185', bg: 'linear-gradient(135deg, #1f0008, #3d0010)' },
        { id: 'chef', label: '👨‍🍳 Chef / Culinary', color: '#fdba74', bg: 'linear-gradient(135deg, #1f0e00, #3d1c00)' },
        { id: 'cyber', label: '🔐 Cyber Security', color: '#67e8f9', bg: 'linear-gradient(135deg, #001518, #00252a)' },
        { id: 'space', label: '🚀 Space / ISRO', color: '#c084fc', bg: 'linear-gradient(135deg, #0f0020, #1e0040)' },
        { id: 'language', label: '🌍 Language Learning', color: '#86efac', bg: 'linear-gradient(135deg, #001a0a, #002e12)' },
    ];

    const handleNext = async () => {
        if (!selectedAim) return alert("Pehle ek Goal chuno!");
        setLoading(true);
        try {
            const res = await fetch(apiUrl('/api/user/goal'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal: selectedAim }),
                credentials: 'include'
            });
            if (res.ok) {
                localStorage.setItem('user_goal', selectedAim);
                window.location.replace('/');
            } else {
                alert("Server error! Try again.");
            }
        } catch (e) {
            alert("Network error! Server check karo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            padding: '40px 16px 120px',
            textAlign: 'center',
            backgroundColor: '#000',
            minHeight: '100vh',
            color: '#fff',
            fontFamily: 'sans-serif'
        }}>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <div style={{
                    fontSize: '36px',
                    marginBottom: '8px',
                    filter: 'drop-shadow(0 0 12px #f59e0b)'
                }}>🎯</div>
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    margin: 0,
                    background: 'linear-gradient(135deg, #f59e0b, #ec4899, #3b82f6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>Apna Goal Chuno</h2>
                <p style={{
                    color: '#444',
                    marginTop: '6px',
                    fontSize: '13px',
                    letterSpacing: '1px'
                }}>NO DISTRACTIONS. ONLY YOUR GOAL.</p>
            </div>

            {/* Aims Grid */}
            <div style={{ display: 'grid', gap: '10px' }}>
                {aims.map((aim) => {
                    const isSelected = selectedAim === aim.id;
                    return (
                        <button
                            key={aim.id}
                            onClick={() => setSelectedAim(aim.id)}
                            style={{
                                padding: '15px 18px',
                                borderRadius: '14px',
                                border: isSelected
                                    ? `2px solid ${aim.color}`
                                    : '1px solid #1f1f1f',
                                background: isSelected ? aim.bg : '#0a0a0a',
                                color: isSelected ? aim.color : '#555',
                                fontSize: '15px',
                                fontWeight: isSelected ? '700' : '400',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.25s ease',
                                boxShadow: isSelected
                                    ? `0 0 16px ${aim.color}55, inset 0 0 20px ${aim.color}11`
                                    : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                            {/* Glow line on left */}
                            {isSelected && (
                                <div style={{
                                    position: 'absolute',
                                    left: 0, top: 0, bottom: 0,
                                    width: '4px',
                                    background: aim.color,
                                    borderRadius: '4px 0 0 4px',
                                    boxShadow: `0 0 8px ${aim.color}`
                                }} />
                            )}
                            <span style={{ marginLeft: isSelected ? '8px' : '0' }}>
                                {aim.label}
                            </span>
                            {isSelected && (
                                <span style={{
                                    marginLeft: 'auto',
                                    fontSize: '16px',
                                    filter: `drop-shadow(0 0 4px ${aim.color})`
                                }}>✦</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Start Button */}
            <div style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                padding: '16px',
                background: 'linear-gradient(to top, #000 60%, transparent)',
            }}>
                <button
                    onClick={handleNext}
                    disabled={loading || !selectedAim}
                    style={{
                        width: '100%',
                        padding: '17px',
                        borderRadius: '16px',
                        background: selectedAim
                            ? 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6, #3b82f6)'
                            : '#111',
                        color: selectedAim ? '#fff' : '#333',
                        fontWeight: '800',
                        border: 'none',
                        fontSize: '16px',
                        cursor: selectedAim ? 'pointer' : 'not-allowed',
                        transition: 'all 0.3s ease',
                        boxShadow: selectedAim
                            ? '0 0 30px #ec489977, 0 0 60px #3b82f644'
                            : 'none',
                        letterSpacing: '0.5px'
                    }}>
                    {loading ? '⏳ Saving...' : '🚀 Start My Journey'}
                </button>
            </div>
        </div>
    );
};

export default AimSelection;
