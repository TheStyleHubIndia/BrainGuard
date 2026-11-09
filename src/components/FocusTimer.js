import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
const PRESETS = [15, 25, 45, 60];
export default function FocusTimer({ onComplete }) {
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(1500);
  const [running, setRunning] = useState(false);
  const deadline = useRef(null);
  const completed = useRef(false);
  useEffect(() => {
    if (!running) return undefined;
    deadline.current = Date.now() + remaining * 1000;
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        if (!completed.current) { completed.current = true; onComplete?.(minutes); }
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [running]);
  function choosePreset(value) { if (running) return; completed.current = false; setMinutes(value); setRemaining(value * 60); }
  function reset() { setRunning(false); completed.current = false; setRemaining(minutes * 60); }
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = 1 - remaining / (minutes * 60);
  return <View style={s.card}>
    <Text style={s.eyebrow}>DEEP WORK · DISTRACTION-FREE</Text>
    <Text style={s.title}>Focus timer</Text>
    <Text style={s.copy}>Timed focus sessions are recorded separately from social-app usage.</Text>
    <View style={s.presets}>{PRESETS.map(value => <TouchableOpacity key={value} disabled={running} onPress={() => choosePreset(value)} style={[s.preset, minutes === value && s.presetActive]}><Text style={[s.presetText, minutes === value && s.presetTextActive]}>{value}m</Text></TouchableOpacity>)}</View>
    <View style={s.timerWrap}><Text style={s.time}>{mm}:{ss}</Text><Text style={s.status}>{running ? "SESSION IN PROGRESS" : remaining === 0 ? "SESSION COMPLETE" : "READY WHEN YOU ARE"}</Text></View>
    <View style={s.track}><View style={[s.fill, { width: (progress * 100) + "%" }]} /></View>
    <View style={s.actions}>
      <TouchableOpacity style={s.primary} onPress={() => { if (running) { setRunning(false); return; } if (remaining === 0) { completed.current = false; setRemaining(minutes * 60); setRunning(true); return; } setRunning(true); }}><Text style={s.primaryText}>{running ? "PAUSE" : remaining === 0 ? "START AGAIN" : "START FOCUS"}</Text></TouchableOpacity>
      <TouchableOpacity style={s.secondary} onPress={reset}><Text style={s.secondaryText}>RESET</Text></TouchableOpacity>
    </View>
  </View>;
}
const s = StyleSheet.create({
  card:{backgroundColor:"#111A17",borderRadius:22,padding:18,borderWidth:1,borderColor:"#2B5741"},
  eyebrow:{color:"#8CE0B4",fontSize:9,fontWeight:"900",letterSpacing:1.4},
  title:{color:"#F2F8F4",fontSize:18,fontWeight:"900",marginTop:8},
  copy:{color:"#94A49D",fontSize:12,lineHeight:18,marginTop:5},
  presets:{flexDirection:"row",gap:8,marginTop:16},
  preset:{flex:1,alignItems:"center",paddingVertical:10,borderRadius:10,backgroundColor:"#0B1410",borderWidth:1,borderColor:"#2B4035"},
  presetActive:{backgroundColor:"#234B39",borderColor:"#42B77B"},
  presetText:{color:"#94A49D",fontWeight:"800",fontSize:12},
  presetTextActive:{color:"#B9F3D0"},
  timerWrap:{alignItems:"center",paddingVertical:18},
  time:{color:"#F4FAF6",fontSize:48,fontWeight:"900",fontVariant:["tabular-nums"]},
  status:{color:"#8CE0B4",fontSize:9,fontWeight:"900",letterSpacing:1.2,marginTop:5},
  track:{height:7,borderRadius:8,backgroundColor:"#263B31",overflow:"hidden"},
  fill:{height:7,backgroundColor:"#42B77B"},
  actions:{flexDirection:"row",gap:9,marginTop:15},
  primary:{flex:1,minHeight:44,borderRadius:12,backgroundColor:"#2F9D67",justifyContent:"center",alignItems:"center"},
  primaryText:{color:"#FFFFFF",fontWeight:"900",fontSize:10,letterSpacing:.5},
  secondary:{paddingHorizontal:17,minHeight:44,borderRadius:12,backgroundColor:"#1A3025",justifyContent:"center",alignItems:"center",borderWidth:1,borderColor:"#2A4938"},
  secondaryText:{color:"#A8E8C2",fontWeight:"900",fontSize:10}
});
