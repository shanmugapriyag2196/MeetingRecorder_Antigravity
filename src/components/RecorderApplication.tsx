"use client";

import React, { useState, useRef, useEffect } from 'react';

// Interfaces for UI state
interface Recording {
    id: string;
    url: string;
    name: string;
    date: string;
    transcription: string[];
}

export default function RecorderApplication() {
    const [isRecording, setIsRecording] = useState(false);
    const [transcriptions, setTranscriptions] = useState<{ text: string, isFinal: boolean }[]>([]);
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [viewTranscript, setViewTranscript] = useState<Recording | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const transcriptionsRef = useRef<{ text: string, isFinal: boolean }[]>([]);

    // Fetch past recordings from API
    const fetchRecordings = () => {
        fetch('/api/recordings?t=' + Date.now(), { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (data.recordings) setRecordings(data.recordings);
            })
            .catch(err => console.error("Error fetching recordings:", err));
    };

    useEffect(() => {
        fetchRecordings();
    }, []);

    const initSpeechRecognition = () => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                    setTranscriptions(prev => {
                        const newList = [...prev.filter(t => t.isFinal)];
                        newList.push({ text: event.results[i][0].transcript, isFinal: true });
                        transcriptionsRef.current = newList;
                        return newList;
                    });
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (interimTranscript) {
                setTranscriptions(prev => {
                    const newList = [...prev.filter(t => t.isFinal)];
                    newList.push({ text: interimTranscript, isFinal: false });
                    transcriptionsRef.current = newList;
                    return newList;
                });
            }
        };

        return recognition;
    };

    const startRecording = async () => {
        try {
            chunksRef.current = [];
            transcriptionsRef.current = [];
            setTranscriptions([]);

            // 1. Get screen stream
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

            // 2. Get microphone stream
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

            // Mix streams
            const mixedStream = new MediaStream([
                ...displayStream.getVideoTracks(),
                ...micStream.getAudioTracks(),
                ...displayStream.getAudioTracks()
            ]);

            streamRef.current = mixedStream;

            if (videoRef.current) {
                videoRef.current.srcObject = mixedStream;
                videoRef.current.play();
            }

            // Initialize recorder
            const mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm; codecs=vp9' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                await saveRecording(blob);
            };

            mediaRecorder.start(1000);
            setIsRecording(true);

            // Start Recognition
            const recognition = initSpeechRecognition();
            if (recognition) {
                recognitionRef.current = recognition;
                recognition.start();
            }

        } catch (err) {
            console.error("Error starting recording:", err);
            alert("Microphone/Screen permissions denied or error occurred.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (recognitionRef.current) recognitionRef.current.stop();
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
        }
    };

    const saveRecording = async (blob: Blob) => {
        setIsSaving(true);
        const formData = new FormData();
        formData.append("file", blob, `Recording-${new Date().toISOString()}.webm`);
        // Use the Ref here to avoid the React stale closure bug!
        const finalTranscripts = transcriptionsRef.current.map(t => t.text);
        formData.append("transcription", JSON.stringify(finalTranscripts));

        const d = new Date();
        const localDate = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        formData.append("date", localDate);

        try {
            const res = await fetch("/api/recordings", { method: 'POST', body: formData });
            await res.json();
            // Refetch all recordings from server to guarantee sync
            fetchRecordings();
        } catch (err) {
            console.error("Error saving to backend", err);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteRecording = async (url: string) => {
        try {
            const res = await fetch("/api/recordings", {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            await res.json();
            fetchRecordings();
        } catch (err) {
            console.error("Error deleting", err);
        }
    };

    const renameRecording = async (url: string, currentName: string) => {
        const newName = prompt("Enter new name for recording:", currentName);
        if (!newName || newName.trim() === "" || newName === currentName) return;

        const trimmedName = newName.trim();
        setRecordings(prev => prev.map(rec => rec.url === url ? { ...rec, name: trimmedName } : rec));

        try {
            await fetch("/api/recordings", {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, newName: trimmedName })
            });
            fetchRecordings();
        } catch (err) {
            console.error("Error renaming", err);
        }
    };

    return (
        <>
            {/* Left Sidebar - OBS Sources Dummy */}
            <div className="sidebar">
                <div className="sidebar-title">Scenes & Sources</div>
                <div className="flex-col" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--accent-blue)' }}>👁</span> Display Capture
                    </div>
                    <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--accent-blue)' }}>👁</span> Audio Input Capture
                    </div>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="workspace">

                {/* Preview Container */}
                <div className="preview-container">
                    <video ref={videoRef} className="preview-video" muted playsInline />
                    <div className="status-badge">
                        <div className={`indicator ${isRecording ? 'recording' : ''}`}></div>
                        {isRecording ? 'REC' : 'STANDBY'}
                    </div>

                    {/* On-Screen Transcription Overlay */}
                    <div className="transcription-overlay">
                        {transcriptions.slice(-3).map((t, i) => (
                            <div key={i} className={`overlay-text ${t.isFinal ? '' : 'interim'}`}>
                                {t.text}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Controls Deck */}
                <div className="controls-deck">

                    <div className="deck-section" style={{ maxWidth: '250px' }}>
                        <div className="section-title">Controls</div>
                        <div className="flex-col jc-between mt-auto">
                            {!isRecording ? (
                                <button className="btn btn-primary" onClick={startRecording}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
                                    Start Recording
                                </button>
                            ) : (
                                <button className="btn btn-danger" onClick={stopRecording}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="6" width="12" height="12" fill="currentColor" /></svg>
                                    Stop Recording
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="deck-section">
                        <div className="section-title">Audio Mixer</div>
                        <div className="flex-col" style={{ height: '100%', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                                <span style={{ fontSize: '20px' }}>🎤</span>
                                <input type="range" min="0" max="100" defaultValue="80" style={{ flex: 1, accentColor: 'var(--accent-blue)' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                                <span style={{ fontSize: '20px' }}>🔊</span>
                                <input type="range" min="0" max="100" defaultValue="100" style={{ flex: 1, accentColor: 'var(--accent-blue)' }} />
                            </div>
                        </div>
                    </div>

                    <div className="deck-section" style={{ flex: 2 }}>
                        <div className="section-title">Live Transcription</div>
                        <div className="scrollable-list">
                            {transcriptions.length === 0 ? (
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Waiting for speech...</div>
                            ) : (
                                transcriptions.map((t, i) => (
                                    <div key={i} className={`transcription-line ${t.isFinal ? '' : 'interim'}`}>
                                        {t.text}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Right Sidebar - History */}
            <div className="sidebar" style={{ borderRight: 'none', borderLeft: '1px solid var(--border-color)' }}>
                <div className="sidebar-title">Recording History</div>
                <div className="history-list">
                    {isSaving && (
                        <div style={{ padding: '16px', fontSize: '14px', color: 'var(--accent-blue)', textAlign: 'center' }}>
                            Uploading to Cloud... (eta ~5sec)
                        </div>
                    )}
                    {recordings.length === 0 && !isSaving ? (
                        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            No recordings yet.
                        </div>
                    ) : (
                        recordings.map(rec => (
                            <div key={rec.id} className="history-item" style={{ padding: '12px 16px' }}>
                                <a href={rec.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', marginBottom: '12px' }}>
                                    <div className="history-title">{rec.name}</div>
                                    <div className="history-meta" style={{ marginTop: '4px' }}>
                                        <span>{rec.date}</span>
                                    </div>
                                </a>
                                <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                    <button
                                        onClick={() => setViewTranscript(rec)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '15px' }}
                                        title="View Transcript"
                                    >
                                        📄
                                    </button>
                                    <button
                                        onClick={() => renameRecording(rec.url, rec.name)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '15px' }}
                                        title="Rename Recording"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => deleteRecording(rec.url)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', fontSize: '15px' }}
                                        title="Delete Recording"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Transcript Modal */}
            {viewTranscript && (
                <div className="modal-overlay" onClick={() => setViewTranscript(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '24px' }}>
                        <div className="modal-header" style={{ marginBottom: '16px' }}>
                            <div className="modal-title">Transcript: {viewTranscript.name}</div>
                            <button className="modal-close" onClick={() => setViewTranscript(null)}>×</button>
                        </div>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', lineHeight: '1.6', fontSize: '14px', color: 'var(--text-main)', padding: '16px', background: 'var(--bg-main)', borderRadius: '6px' }}>
                            {viewTranscript.transcription && viewTranscript.transcription.length > 0 ? (
                                viewTranscript.transcription.map((t, idx) => <p key={idx} style={{ marginBottom: '8px' }}>{t}</p>)
                            ) : (
                                <p style={{ color: 'var(--text-muted)' }}>No transcription data was captured for this recording.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
