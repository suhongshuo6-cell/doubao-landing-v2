/**
 * faceExprConfig.ts — doubao_face.webp（1280×720）上眼睛/嘴的几何标定。
 *
 * 所有点都是**归一化图片坐标**（x/1280, y/720，y 自上而下），由
 * /workspace/expr-debug/fit.py 在原图上画线逐像素对齐过。
 * 每条曲线用 3 个点（外角/中点/内角）定义二次曲线，shader 内求值。
 */
export const FACE_IMG_W = 1280
export const FACE_IMG_H = 720

type P = readonly [number, number]
const n = (x: number, y: number): P => [x / FACE_IMG_W, y / FACE_IMG_H]

export interface EyeSpec {
  /** 上眼睑睫毛线（眼裂上缘） */
  top: readonly [P, P, P]
  /** 下眼睑（眼裂下缘），两端与 top 共点 = 眼角 */
  bot: readonly [P, P, P]
  /** 上眼睑皮肤参与"拉下来"的高度（px）—— 闭眼时这段皮肤被拉伸盖住眼裂 */
  lidSkinPx: number
  /** 眼皮肤色 sRGB 0-255：眼裂 x 小端 / x 大端（原图高斯 3px 后取样） */
  lidRgb: readonly [readonly [number, number, number], readonly [number, number, number]]
}

export const FACE_EXPR = {
  /** 画面左侧那只眼（她的右眼）—— v2 新脸重新标定 */
  eyeL: {
    top: [n(501, 311), n(544, 293), n(588, 319)],
    bot: [n(501, 311), n(541, 326), n(588, 319)],
    lidSkinPx: 24,
    lidRgb: [[232, 196, 182], [236, 200, 186]],
  } satisfies EyeSpec,
  /** 画面右侧那只眼（她的左眼） */
  eyeR: {
    top: [n(702, 308), n(743, 277), n(787, 290)],
    bot: [n(702, 308), n(744, 312), n(787, 290)],
    lidSkinPx: 23,
    lidRgb: [[236, 200, 186], [232, 196, 182]],
  } satisfies EyeSpec,
  /** 唇缝：左嘴角 / 中点 / 右嘴角 */
  mouth: [n(577, 493), n(654, 503), n(737, 481)] as readonly [P, P, P],
  /** 腮红中心与半径（px） */
  cheekL: { c: n(526, 368), r: [52, 33] as const },
  cheekR: { c: n(774, 365), r: [47, 31] as const },
  /** 视线最大位移（px，原图尺度） */
  gazePx: [8.4, 4.2] as const,
  /** 说话时下唇最大下移（px） */
  mouthOpenPx: 13,
}

/** 三点 → y = a x² + b x + c（像素坐标） */
export function quadFrom(pts: readonly [P, P, P]): [number, number, number] {
  const [[x0, y0], [x1, y1], [x2, y2]] = pts.map(([x, y]) => [x * FACE_IMG_W, y * FACE_IMG_H]) as [
    [number, number], [number, number], [number, number],
  ]
  const d = (x0 - x1) * (x0 - x2) * (x1 - x2)
  const a = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / d
  const b = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / d
  const c = (x1 * x2 * (x1 - x2) * y0 + x2 * x0 * (x2 - x0) * y1 + x0 * x1 * (x0 - x1) * y2) / d
  return [a, b, c]
}
