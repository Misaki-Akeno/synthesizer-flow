import { expect, test } from '@playwright/test';

test('音序器在动画帧暂停时仍能发声、释音，并在停止后保持静音', async ({
  page,
}) => {
  // 仪表只注入测试浏览器。输出经过零增益节点，测试不会从用户扬声器发声。
  await page.addInitScript(() => {
    const meters: AnalyserNode[] = [];
    const connect = AudioNode.prototype.connect as (
      this: AudioNode,
      destination: AudioNode | AudioParam,
      output?: number,
      input?: number
    ) => AudioNode | undefined;
    AudioNode.prototype.connect = function (
      this: AudioNode,
      destination: AudioNode | AudioParam,
      output = 0,
      input = 0
    ) {
      if (destination instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser();
        analyser.fftSize = 2048;
        const mute = this.context.createGain();
        mute.gain.value = 0;
        connect.call(this, analyser, output, 0);
        connect.call(analyser, mute, 0, 0);
        connect.call(mute, destination, 0, input);
        meters.push(analyser);
        return destination;
      }
      if (destination instanceof AudioParam) {
        return connect.call(this, destination, output);
      }
      return connect.call(this, destination, output, input);
    } as typeof AudioNode.prototype.connect;
    Object.assign(window, {
      readTestAudioLevel: () =>
        Math.max(
          0,
          ...meters.map((meter) => {
            const samples = new Float32Array(meter.fftSize);
            meter.getFloatTimeDomainData(samples);
            return Math.sqrt(
              samples.reduce((sum, sample) => sum + sample * sample, 0) /
                samples.length
            );
          })
        ),
    });
  });
  await page.goto('/zh-CN');
  await page
    .getByRole('button', { name: /新建项目.*从空白画布开始创作/ })
    .click();
  await page.getByRole('button', { name: '项目管理器', exact: true }).click();
  const clip = {
    version: 2,
    ppq: 480,
    bars: 1,
    timeSignature: [4, 4],
    notes: [
      {
        id: 'pulse',
        midi: 69,
        startTick: 0,
        durationTicks: 480,
        velocity: 0.8,
      },
    ],
    events: [],
  };
  const canvas = {
    version: '1.0',
    timestamp: Date.now(),
    nodes: [
      {
        id: 'clip',
        position: { x: 0, y: 0 },
        data: {
          type: 'sequencer',
          label: 'Test clip',
          parameters: { bpm: 120, running: false, clip: JSON.stringify(clip) },
        },
      },
      {
        id: 'synth',
        position: { x: 260, y: 0 },
        data: {
          type: 'advancedoscillator',
          label: 'Test synth',
          parameters: { release: 0.05 },
        },
      },
      {
        id: 'speaker',
        position: { x: 520, y: 0 },
        data: {
          type: 'speaker',
          label: 'Test output',
          parameters: { level: -24 },
        },
      },
    ],
    edges: [
      {
        source: 'clip',
        sourceHandle: 'midi',
        target: 'synth',
        targetHandle: 'midi',
      },
      {
        source: 'synth',
        sourceHandle: 'audioout',
        target: 'speaker',
        targetHandle: 'audioInLeft',
      },
    ],
  };
  await page.getByLabel('导入项目 JSON').setInputFiles({
    name: 'audio-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(canvas)),
  });
  await expect(
    page.locator('[data-module-type="advancedoscillator"]')
  ).toHaveCount(1);
  await page.getByRole('button', { name: '项目管理器', exact: true }).click();
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  await page.getByRole('button', { name: '启动音频', exact: true }).click();
  await page.getByRole('button', { name: 'Play MIDI clip' }).click();
  const level = () =>
    page.evaluate(() =>
      (
        window as unknown as { readTestAudioLevel: () => number }
      ).readTestAudioLevel()
    );
  await expect.poll(level, { timeout: 10_000 }).toBeGreaterThan(0.0001);
  await page.evaluate(() => {
    Object.assign(window, { originalTestRAF: window.requestAnimationFrame });
    window.requestAnimationFrame = () => 0;
  });
  try {
    await expect.poll(level, { timeout: 4_000 }).toBeLessThan(0.00001);
    await expect.poll(level, { timeout: 4_000 }).toBeGreaterThan(0.0001);
  } finally {
    await page.evaluate(() => {
      window.requestAnimationFrame = (
        window as unknown as {
          originalTestRAF: typeof window.requestAnimationFrame;
        }
      ).originalTestRAF;
    });
  }
  await page.getByRole('button', { name: 'Stop MIDI clip' }).click();
  await expect.poll(level, { timeout: 3_000 }).toBeLessThan(0.00001);
  // 覆盖下一循环起点，确保预调度的 noteOn 不会在停止后重新发声。
  const levels: number[] = [];
  for (let index = 0; index < 10; index += 1) {
    await page.waitForTimeout(250);
    levels.push(await level());
  }
  expect(Math.max(...levels)).toBeLessThan(0.00001);
});
