export const BLOOP_WGSL = `
struct UBO {
  time: f32,
  micLevel: f32,
  stateListen: f32,
  listenTimestamp: f32,
  stateThink: f32,
  thinkTimestamp: f32,
  stateSpeak: f32,
  speakTimestamp: f32,
  avgMag: vec4<f32>,
  cumulativeAudio: vec4<f32>,
  viewport: vec2<f32>,
  watercolorStrength: f32,
  watercolorAnimated: f32,
  bloopColorMain: vec4<f32>,
  bloopColorLow: vec4<f32>,
  bloopColorMid: vec4<f32>,
  bloopColorHigh: vec4<f32>,
};

@group(0) @binding(0) var<uniform> ubo: UBO;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );
  var uv = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0)
  );
  var out: VertexOutput;
  out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  out.uv = uv[vertexIndex];
  return out;
}

fn hash(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2<f32>(0.0, 0.0)), hash(i + vec2<f32>(1.0, 0.0)), u.x),
    mix(hash(i + vec2<f32>(0.0, 1.0)), hash(i + vec2<f32>(1.0, 1.0)), u.x),
    u.y
  );
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let p = (in.uv - vec2<f32>(0.5)) * 2.0;
  let d = length(p);

  // Dynamic distortion based on audio and states
  let angle = atan2(p.y, p.x);
  let pulse = sin(ubo.time * 2.5) * 0.04 + ubo.micLevel * 0.2;
  let thinkSpin = ubo.stateThink * sin(angle * 3.0 + ubo.time * 4.0) * 0.05;
  let speakWobble = ubo.stateSpeak * sin(angle * 5.0 + ubo.cumulativeAudio.x) * 0.08;

  let r = 0.55 + pulse + thinkSpin + speakWobble;
  let n = noise(p * 2.5 + vec2<f32>(ubo.time * 0.4, ubo.time * 0.3)) * 0.1;

  let dist = d - (r + n);
  let alpha = 1.0 - smoothstep(-0.04, 0.04, dist);

  if (alpha <= 0.001) {
    discard;
  }

  // Color blending from palettes
  var col = mix(ubo.bloopColorLow.rgb, ubo.bloopColorMain.rgb, smoothstep(0.0, 0.8, d));
  col = mix(col, ubo.bloopColorHigh.rgb, smoothstep(0.3, 0.0, d));

  if (ubo.stateSpeak > 0.5) {
    col = mix(col, ubo.bloopColorMid.rgb, 0.5 + 0.5 * sin(ubo.time * 6.0));
  } else if (ubo.stateThink > 0.5) {
    col = mix(col, vec3<f32>(0.8, 0.9, 1.0), 0.3 * sin(ubo.time * 4.0) + 0.3);
  }

  return vec4<f32>(col * alpha, alpha);
}
`;
