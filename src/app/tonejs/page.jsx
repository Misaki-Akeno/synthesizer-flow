"use client";

import { useEffect, useState, useRef } from "react";
import * as Tone from "tone";

export default function ToneJSExample() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [notes, setNotes] = useState(["C4", "E4", "G4", "B4"]);
  const [filterFreq, setFilterFreq] = useState(1000);
  const synthRef = useRef(null);
  const filterRef = useRef(null);
  const sequenceRef = useRef(null);

  useEffect(() => {
    // 创建合成器和效果器
    synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    filterRef.current = new Tone.Filter(filterFreq, "highpass").toDestination();
    synthRef.current.connect(filterRef.current);

    // 创建音序器
    sequenceRef.current = new Tone.Sequence(
      (time, note) => {
        synthRef.current.triggerAttackRelease(note, "8n", time);
      },
      notes,
      "4n"
    );

    // 清理函数
    return () => {
      if (sequenceRef.current) sequenceRef.current.dispose();
      if (synthRef.current) synthRef.current.dispose();
      if (filterRef.current) filterRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    if (filterRef.current) {
      filterRef.current.frequency.value = filterFreq;
    }
  }, [filterFreq]);

  useEffect(() => {
    if (sequenceRef.current) {
      sequenceRef.current.events = notes;
    }
  }, [notes]);

  const togglePlayback = async () => {
    if (Tone.Transport.state === "started") {
      Tone.Transport.stop();
      sequenceRef.current.stop();
      setIsPlaying(false);
    } else {
      await Tone.start(); // 启动音频上下文，通常需要由用户手势触发
      Tone.Transport.start();
      sequenceRef.current.start();
      setIsPlaying(true);
    }
  };

  const playNote = (note) => {
    synthRef.current.triggerAttackRelease(note, "8n");
  };

  const updateSequence = (index, newNote) => {
    const newNotes = [...notes];
    newNotes[index] = newNote;
    setNotes(newNotes);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">ToneJS 示例</h1>
      
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">简单钢琴</h2>
        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => playNote("C4")}
            className="bg-white border border-black px-4 py-6 w-12"
          >
            C
          </button>
          <button 
            onClick={() => playNote("D4")}
            className="bg-white border border-black px-4 py-6 w-12"
          >
            D
          </button>
          <button 
            onClick={() => playNote("E4")}
            className="bg-white border border-black px-4 py-6 w-12"
          >
            E
          </button>
          <button 
            onClick={() => playNote("F4")}
            className="bg-white border border-black px-4 py-6 w-12"
          >
            F
          </button>
          <button 
            onClick={() => playNote("G4")}
            className="bg-white border border-black px-4 py-6 w-12"
          >
            G
          </button>
          <button 
            onClick={() => playNote("A4")}
            className="bg-white border border-black px-4 py-6 w-12"
          >
            A
          </button>
          <button 
            onClick={() => playNote("B4")}
            className="bg-white border border-black px-4 py-6 w-12"
          >
            B
          </button>
          <button 
            onClick={() => playNote("C5")}
            className="bg-white border border-black px-4 py-6 w-12"
          >
            C
          </button>
        </div>
      </section>
      
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">音序器</h2>
        <div className="mb-4">
          <button 
            onClick={togglePlayback}
            className={`px-4 py-2 rounded-md ${isPlaying ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
          >
            {isPlaying ? "停止" : "播放"}
          </button>
        </div>
        
        <div className="flex gap-4 mb-4">
          {notes.map((note, index) => (
            <div key={index} className="text-center">
              <select 
                value={note}
                onChange={(e) => updateSequence(index, e.target.value)}
                className="block border border-gray-300 rounded px-2 py-1"
              >
                <option value="C4">C4</option>
                <option value="D4">D4</option>
                <option value="E4">E4</option>
                <option value="F4">F4</option>
                <option value="G4">G4</option>
                <option value="A4">A4</option>
                <option value="B4">B4</option>
                <option value="C5">C5</option>
              </select>
              <div className="mt-2 text-sm">音符 {index + 1}</div>
            </div>
          ))}
        </div>
      </section>
      
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">滤波器控制</h2>
        <div className="flex items-center gap-4">
          <div className="w-32">过滤器频率:</div>
          <input 
            type="range"
            min="100"
            max="10000"
            value={filterFreq}
            onChange={(e) => setFilterFreq(Number(e.target.value))}
            className="flex-grow"
          />
          <div className="w-24">{filterFreq} Hz</div>
        </div>
      </section>
    </div>
  );
}