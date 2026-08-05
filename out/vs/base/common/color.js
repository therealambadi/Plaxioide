import { CharCode } from "./charCode.js";
function roundFloat(number, decimalPoints) {
  const decimal = Math.pow(10, decimalPoints);
  return Math.round(number * decimal) / decimal;
}
class RGBA {
  constructor(r, g, b, a = 1) {
    this._rgbaBrand = void 0;
    this.r = Math.min(255, Math.max(0, r)) | 0;
    this.g = Math.min(255, Math.max(0, g)) | 0;
    this.b = Math.min(255, Math.max(0, b)) | 0;
    this.a = roundFloat(Math.max(Math.min(1, a), 0), 3);
  }
  static equals(a, b) {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
  }
}
class HSLA {
  constructor(h, s, l, a) {
    this._hslaBrand = void 0;
    this.h = Math.max(Math.min(360, h), 0) | 0;
    this.s = roundFloat(Math.max(Math.min(1, s), 0), 3);
    this.l = roundFloat(Math.max(Math.min(1, l), 0), 3);
    this.a = roundFloat(Math.max(Math.min(1, a), 0), 3);
  }
  static equals(a, b) {
    return a.h === b.h && a.s === b.s && a.l === b.l && a.a === b.a;
  }
  /**
   * Converts an RGB color value to HSL. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes r, g, and b are contained in the set [0, 255] and
   * returns h in the set [0, 360], s, and l in the set [0, 1].
   */
  static fromRGBA(rgba) {
    const r = rgba.r / 255;
    const g = rgba.g / 255;
    const b = rgba.b / 255;
    const a = rgba.a;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (min + max) / 2;
    const chroma = max - min;
    if (chroma > 0) {
      s = Math.min(l <= 0.5 ? chroma / (2 * l) : chroma / (2 - 2 * l), 1);
      switch (max) {
        case r:
          h = (g - b) / chroma + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / chroma + 2;
          break;
        case b:
          h = (r - g) / chroma + 4;
          break;
      }
      h *= 60;
      h = Math.round(h);
    }
    return new HSLA(h, s, l, a);
  }
  static _hue2rgb(p, q, t) {
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  }
  /**
   * Converts an HSL color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes h in the set [0, 360] s, and l are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   */
  static toRGBA(hsla) {
    const h = hsla.h / 360;
    const { s, l, a } = hsla;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = HSLA._hue2rgb(p, q, h + 1 / 3);
      g = HSLA._hue2rgb(p, q, h);
      b = HSLA._hue2rgb(p, q, h - 1 / 3);
    }
    return new RGBA(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), a);
  }
}
class HSVA {
  constructor(h, s, v, a) {
    this._hsvaBrand = void 0;
    this.h = Math.max(Math.min(360, h), 0) | 0;
    this.s = roundFloat(Math.max(Math.min(1, s), 0), 3);
    this.v = roundFloat(Math.max(Math.min(1, v), 0), 3);
    this.a = roundFloat(Math.max(Math.min(1, a), 0), 3);
  }
  static equals(a, b) {
    return a.h === b.h && a.s === b.s && a.v === b.v && a.a === b.a;
  }
  // from http://www.rapidtables.com/convert/color/rgb-to-hsv.htm
  static fromRGBA(rgba) {
    const r = rgba.r / 255;
    const g = rgba.g / 255;
    const b = rgba.b / 255;
    const cmax = Math.max(r, g, b);
    const cmin = Math.min(r, g, b);
    const delta = cmax - cmin;
    const s = cmax === 0 ? 0 : delta / cmax;
    let m;
    if (delta === 0) {
      m = 0;
    } else if (cmax === r) {
      m = ((g - b) / delta % 6 + 6) % 6;
    } else if (cmax === g) {
      m = (b - r) / delta + 2;
    } else {
      m = (r - g) / delta + 4;
    }
    return new HSVA(Math.round(m * 60), s, cmax, rgba.a);
  }
  // from http://www.rapidtables.com/convert/color/hsv-to-rgb.htm
  static toRGBA(hsva) {
    const { h, s, v, a } = hsva;
    const c = v * s;
    const x = c * (1 - Math.abs(h / 60 % 2 - 1));
    const m = v - c;
    let [r, g, b] = [0, 0, 0];
    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else if (h <= 360) {
      r = c;
      b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return new RGBA(r, g, b, a);
  }
}
const _Color = class _Color {
  static fromHex(hex) {
    return _Color.Format.CSS.parseHex(hex) || _Color.red;
  }
  static equals(a, b) {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.equals(b);
  }
  get hsla() {
    if (this._hsla) {
      return this._hsla;
    } else {
      return HSLA.fromRGBA(this.rgba);
    }
  }
  get hsva() {
    if (this._hsva) {
      return this._hsva;
    }
    return HSVA.fromRGBA(this.rgba);
  }
  constructor(arg) {
    if (!arg) {
      throw new Error("Color needs a value");
    } else if (arg instanceof RGBA) {
      this.rgba = arg;
    } else if (arg instanceof HSLA) {
      this._hsla = arg;
      this.rgba = HSLA.toRGBA(arg);
    } else if (arg instanceof HSVA) {
      this._hsva = arg;
      this.rgba = HSVA.toRGBA(arg);
    } else {
      throw new Error("Invalid color ctor argument");
    }
  }
  equals(other) {
    return !!other && RGBA.equals(this.rgba, other.rgba) && HSLA.equals(this.hsla, other.hsla) && HSVA.equals(this.hsva, other.hsva);
  }
  /**
   * http://www.w3.org/TR/WCAG20/#relativeluminancedef
   * Returns the number in the set [0, 1]. O => Darkest Black. 1 => Lightest white.
   */
  getRelativeLuminance() {
    const R = _Color._relativeLuminanceForComponent(this.rgba.r);
    const G = _Color._relativeLuminanceForComponent(this.rgba.g);
    const B = _Color._relativeLuminanceForComponent(this.rgba.b);
    const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    return roundFloat(luminance, 4);
  }
  /**
   * Reduces the "foreground" color on this "background" color unti it is
   * below the relative luminace ratio.
   * @returns the new foreground color
   * @see https://github.com/xtermjs/xterm.js/blob/44f9fa39ae03e2ca6d28354d88a399608686770e/src/common/Color.ts#L315
   */
  reduceRelativeLuminace(foreground, ratio) {
    let { r: fgR, g: fgG, b: fgB } = foreground.rgba;
    let cr = this.getContrastRatio(foreground);
    while (cr < ratio && (fgR > 0 || fgG > 0 || fgB > 0)) {
      fgR -= Math.max(0, Math.ceil(fgR * 0.1));
      fgG -= Math.max(0, Math.ceil(fgG * 0.1));
      fgB -= Math.max(0, Math.ceil(fgB * 0.1));
      cr = this.getContrastRatio(new _Color(new RGBA(fgR, fgG, fgB)));
    }
    return new _Color(new RGBA(fgR, fgG, fgB));
  }
  /**
   * Increases the "foreground" color on this "background" color unti it is
   * below the relative luminace ratio.
   * @returns the new foreground color
   * @see https://github.com/xtermjs/xterm.js/blob/44f9fa39ae03e2ca6d28354d88a399608686770e/src/common/Color.ts#L335
   */
  increaseRelativeLuminace(foreground, ratio) {
    let { r: fgR, g: fgG, b: fgB } = foreground.rgba;
    let cr = this.getContrastRatio(foreground);
    while (cr < ratio && (fgR < 255 || fgG < 255 || fgB < 255)) {
      fgR = Math.min(255, fgR + Math.ceil((255 - fgR) * 0.1));
      fgG = Math.min(255, fgG + Math.ceil((255 - fgG) * 0.1));
      fgB = Math.min(255, fgB + Math.ceil((255 - fgB) * 0.1));
      cr = this.getContrastRatio(new _Color(new RGBA(fgR, fgG, fgB)));
    }
    return new _Color(new RGBA(fgR, fgG, fgB));
  }
  static _relativeLuminanceForComponent(color) {
    const c = color / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  /**
   * http://www.w3.org/TR/WCAG20/#contrast-ratiodef
   * Returns the contrast ration number in the set [1, 21].
   */
  getContrastRatio(another) {
    const lum1 = this.getRelativeLuminance();
    const lum2 = another.getRelativeLuminance();
    return lum1 > lum2 ? (lum1 + 0.05) / (lum2 + 0.05) : (lum2 + 0.05) / (lum1 + 0.05);
  }
  /**
   *	http://24ways.org/2010/calculating-color-contrast
   *  Return 'true' if darker color otherwise 'false'
   */
  isDarker() {
    const yiq = (this.rgba.r * 299 + this.rgba.g * 587 + this.rgba.b * 114) / 1e3;
    return yiq < 128;
  }
  /**
   *	http://24ways.org/2010/calculating-color-contrast
   *  Return 'true' if lighter color otherwise 'false'
   */
  isLighter() {
    const yiq = (this.rgba.r * 299 + this.rgba.g * 587 + this.rgba.b * 114) / 1e3;
    return yiq >= 128;
  }
  isLighterThan(another) {
    const lum1 = this.getRelativeLuminance();
    const lum2 = another.getRelativeLuminance();
    return lum1 > lum2;
  }
  isDarkerThan(another) {
    const lum1 = this.getRelativeLuminance();
    const lum2 = another.getRelativeLuminance();
    return lum1 < lum2;
  }
  /**
   * Based on xterm.js: https://github.com/xtermjs/xterm.js/blob/44f9fa39ae03e2ca6d28354d88a399608686770e/src/common/Color.ts#L288
   *
   * Given a foreground color and a background color, either increase or reduce the luminance of the
   * foreground color until the specified contrast ratio is met. If pure white or black is hit
   * without the contrast ratio being met, go the other direction using the background color as the
   * foreground color and take either the first or second result depending on which has the higher
   * contrast ratio.
   *
   * @param foreground The foreground color.
   * @param ratio The contrast ratio to achieve.
   * @returns The adjusted foreground color.
   */
  ensureConstrast(foreground, ratio) {
    const bgL = this.getRelativeLuminance();
    const fgL = foreground.getRelativeLuminance();
    const cr = this.getContrastRatio(foreground);
    if (cr < ratio) {
      if (fgL < bgL) {
        const resultA2 = this.reduceRelativeLuminace(foreground, ratio);
        const resultARatio2 = this.getContrastRatio(resultA2);
        if (resultARatio2 < ratio) {
          const resultB = this.increaseRelativeLuminace(foreground, ratio);
          const resultBRatio = this.getContrastRatio(resultB);
          return resultARatio2 > resultBRatio ? resultA2 : resultB;
        }
        return resultA2;
      }
      const resultA = this.increaseRelativeLuminace(foreground, ratio);
      const resultARatio = this.getContrastRatio(resultA);
      if (resultARatio < ratio) {
        const resultB = this.reduceRelativeLuminace(foreground, ratio);
        const resultBRatio = this.getContrastRatio(resultB);
        return resultARatio > resultBRatio ? resultA : resultB;
      }
      return resultA;
    }
    return foreground;
  }
  lighten(factor) {
    return new _Color(new HSLA(this.hsla.h, this.hsla.s, this.hsla.l + this.hsla.l * factor, this.hsla.a));
  }
  darken(factor) {
    return new _Color(new HSLA(this.hsla.h, this.hsla.s, this.hsla.l - this.hsla.l * factor, this.hsla.a));
  }
  transparent(factor) {
    const { r, g, b, a } = this.rgba;
    return new _Color(new RGBA(r, g, b, a * factor));
  }
  isTransparent() {
    return this.rgba.a === 0;
  }
  isOpaque() {
    return this.rgba.a === 1;
  }
  opposite() {
    return new _Color(new RGBA(255 - this.rgba.r, 255 - this.rgba.g, 255 - this.rgba.b, this.rgba.a));
  }
  blend(c) {
    const rgba = c.rgba;
    const thisA = this.rgba.a;
    const colorA = rgba.a;
    const a = thisA + colorA * (1 - thisA);
    if (a < 1e-6) {
      return _Color.transparent;
    }
    const r = this.rgba.r * thisA / a + rgba.r * colorA * (1 - thisA) / a;
    const g = this.rgba.g * thisA / a + rgba.g * colorA * (1 - thisA) / a;
    const b = this.rgba.b * thisA / a + rgba.b * colorA * (1 - thisA) / a;
    return new _Color(new RGBA(r, g, b, a));
  }
  makeOpaque(opaqueBackground) {
    if (this.isOpaque() || opaqueBackground.rgba.a !== 1) {
      return this;
    }
    const { r, g, b, a } = this.rgba;
    return new _Color(new RGBA(
      opaqueBackground.rgba.r - a * (opaqueBackground.rgba.r - r),
      opaqueBackground.rgba.g - a * (opaqueBackground.rgba.g - g),
      opaqueBackground.rgba.b - a * (opaqueBackground.rgba.b - b),
      1
    ));
  }
  flatten(...backgrounds) {
    const background = backgrounds.reduceRight((accumulator, color) => {
      return _Color._flatten(color, accumulator);
    });
    return _Color._flatten(this, background);
  }
  static _flatten(foreground, background) {
    const backgroundAlpha = 1 - foreground.rgba.a;
    return new _Color(new RGBA(
      backgroundAlpha * background.rgba.r + foreground.rgba.a * foreground.rgba.r,
      backgroundAlpha * background.rgba.g + foreground.rgba.a * foreground.rgba.g,
      backgroundAlpha * background.rgba.b + foreground.rgba.a * foreground.rgba.b
    ));
  }
  toString() {
    if (!this._toString) {
      this._toString = _Color.Format.CSS.format(this);
    }
    return this._toString;
  }
  toNumber32Bit() {
    if (!this._toNumber32Bit) {
      this._toNumber32Bit = (this.rgba.r << 24 | this.rgba.g << 16 | this.rgba.b << 8 | this.rgba.a * 255 << 0) >>> 0;
    }
    return this._toNumber32Bit;
  }
  static getLighterColor(of, relative, factor) {
    if (of.isLighterThan(relative)) {
      return of;
    }
    factor = factor ? factor : 0.5;
    const lum1 = of.getRelativeLuminance();
    const lum2 = relative.getRelativeLuminance();
    factor = factor * (lum2 - lum1) / lum2;
    return of.lighten(factor);
  }
  static getDarkerColor(of, relative, factor) {
    if (of.isDarkerThan(relative)) {
      return of;
    }
    factor = factor ? factor : 0.5;
    const lum1 = of.getRelativeLuminance();
    const lum2 = relative.getRelativeLuminance();
    factor = factor * (lum1 - lum2) / lum1;
    return of.darken(factor);
  }
};
_Color.white = new _Color(new RGBA(255, 255, 255, 1));
_Color.black = new _Color(new RGBA(0, 0, 0, 1));
_Color.red = new _Color(new RGBA(255, 0, 0, 1));
_Color.blue = new _Color(new RGBA(0, 0, 255, 1));
_Color.green = new _Color(new RGBA(0, 255, 0, 1));
_Color.cyan = new _Color(new RGBA(0, 255, 255, 1));
_Color.lightgrey = new _Color(new RGBA(211, 211, 211, 1));
_Color.transparent = new _Color(new RGBA(0, 0, 0, 0));
let Color = _Color;
((Color2) => {
  let Format;
  ((Format2) => {
    let CSS;
    ((CSS2) => {
      function formatRGB(color) {
        if (color.rgba.a === 1) {
          return `rgb(${color.rgba.r}, ${color.rgba.g}, ${color.rgba.b})`;
        }
        return Color2.Format.CSS.formatRGBA(color);
      }
      CSS2.formatRGB = formatRGB;
      function formatRGBA(color) {
        return `rgba(${color.rgba.r}, ${color.rgba.g}, ${color.rgba.b}, ${+color.rgba.a.toFixed(2)})`;
      }
      CSS2.formatRGBA = formatRGBA;
      function formatHSL(color) {
        if (color.hsla.a === 1) {
          return `hsl(${color.hsla.h}, ${(color.hsla.s * 100).toFixed(2)}%, ${(color.hsla.l * 100).toFixed(2)}%)`;
        }
        return Color2.Format.CSS.formatHSLA(color);
      }
      CSS2.formatHSL = formatHSL;
      function formatHSLA(color) {
        return `hsla(${color.hsla.h}, ${(color.hsla.s * 100).toFixed(2)}%, ${(color.hsla.l * 100).toFixed(2)}%, ${color.hsla.a.toFixed(2)})`;
      }
      CSS2.formatHSLA = formatHSLA;
      function _toTwoDigitHex(n) {
        const r = n.toString(16);
        return r.length !== 2 ? "0" + r : r;
      }
      function formatHex(color) {
        return `#${_toTwoDigitHex(color.rgba.r)}${_toTwoDigitHex(color.rgba.g)}${_toTwoDigitHex(color.rgba.b)}`;
      }
      CSS2.formatHex = formatHex;
      function formatHexA(color, compact = false) {
        if (compact && color.rgba.a === 1) {
          return Color2.Format.CSS.formatHex(color);
        }
        return `#${_toTwoDigitHex(color.rgba.r)}${_toTwoDigitHex(color.rgba.g)}${_toTwoDigitHex(color.rgba.b)}${_toTwoDigitHex(Math.round(color.rgba.a * 255))}`;
      }
      CSS2.formatHexA = formatHexA;
      function format(color) {
        if (color.isOpaque()) {
          return Color2.Format.CSS.formatHex(color);
        }
        return Color2.Format.CSS.formatRGBA(color);
      }
      CSS2.format = format;
      function parse(css) {
        if (css === "transparent") {
          return Color2.transparent;
        }
        if (css.startsWith("#")) {
          return parseHex(css);
        }
        if (css.startsWith("rgba(")) {
          const color = css.match(/rgba\((?<r>(?:\+|-)?\d+), *(?<g>(?:\+|-)?\d+), *(?<b>(?:\+|-)?\d+), *(?<a>(?:\+|-)?\d+(\.\d+)?)\)/);
          if (!color) {
            throw new Error("Invalid color format " + css);
          }
          const r = parseInt(color.groups?.r ?? "0");
          const g = parseInt(color.groups?.g ?? "0");
          const b = parseInt(color.groups?.b ?? "0");
          const a = parseFloat(color.groups?.a ?? "0");
          return new Color2(new RGBA(r, g, b, a));
        }
        if (css.startsWith("rgb(")) {
          const color = css.match(/rgb\((?<r>(?:\+|-)?\d+), *(?<g>(?:\+|-)?\d+), *(?<b>(?:\+|-)?\d+)\)/);
          if (!color) {
            throw new Error("Invalid color format " + css);
          }
          const r = parseInt(color.groups?.r ?? "0");
          const g = parseInt(color.groups?.g ?? "0");
          const b = parseInt(color.groups?.b ?? "0");
          return new Color2(new RGBA(r, g, b));
        }
        return parseNamedKeyword(css);
      }
      CSS2.parse = parse;
      function parseNamedKeyword(css) {
        switch (css) {
          case "aliceblue":
            return new Color2(new RGBA(240, 248, 255, 1));
          case "antiquewhite":
            return new Color2(new RGBA(250, 235, 215, 1));
          case "aqua":
            return new Color2(new RGBA(0, 255, 255, 1));
          case "aquamarine":
            return new Color2(new RGBA(127, 255, 212, 1));
          case "azure":
            return new Color2(new RGBA(240, 255, 255, 1));
          case "beige":
            return new Color2(new RGBA(245, 245, 220, 1));
          case "bisque":
            return new Color2(new RGBA(255, 228, 196, 1));
          case "black":
            return new Color2(new RGBA(0, 0, 0, 1));
          case "blanchedalmond":
            return new Color2(new RGBA(255, 235, 205, 1));
          case "blue":
            return new Color2(new RGBA(0, 0, 255, 1));
          case "blueviolet":
            return new Color2(new RGBA(138, 43, 226, 1));
          case "brown":
            return new Color2(new RGBA(165, 42, 42, 1));
          case "burlywood":
            return new Color2(new RGBA(222, 184, 135, 1));
          case "cadetblue":
            return new Color2(new RGBA(95, 158, 160, 1));
          case "chartreuse":
            return new Color2(new RGBA(127, 255, 0, 1));
          case "chocolate":
            return new Color2(new RGBA(210, 105, 30, 1));
          case "coral":
            return new Color2(new RGBA(255, 127, 80, 1));
          case "cornflowerblue":
            return new Color2(new RGBA(100, 149, 237, 1));
          case "cornsilk":
            return new Color2(new RGBA(255, 248, 220, 1));
          case "crimson":
            return new Color2(new RGBA(220, 20, 60, 1));
          case "cyan":
            return new Color2(new RGBA(0, 255, 255, 1));
          case "darkblue":
            return new Color2(new RGBA(0, 0, 139, 1));
          case "darkcyan":
            return new Color2(new RGBA(0, 139, 139, 1));
          case "darkgoldenrod":
            return new Color2(new RGBA(184, 134, 11, 1));
          case "darkgray":
            return new Color2(new RGBA(169, 169, 169, 1));
          case "darkgreen":
            return new Color2(new RGBA(0, 100, 0, 1));
          case "darkgrey":
            return new Color2(new RGBA(169, 169, 169, 1));
          case "darkkhaki":
            return new Color2(new RGBA(189, 183, 107, 1));
          case "darkmagenta":
            return new Color2(new RGBA(139, 0, 139, 1));
          case "darkolivegreen":
            return new Color2(new RGBA(85, 107, 47, 1));
          case "darkorange":
            return new Color2(new RGBA(255, 140, 0, 1));
          case "darkorchid":
            return new Color2(new RGBA(153, 50, 204, 1));
          case "darkred":
            return new Color2(new RGBA(139, 0, 0, 1));
          case "darksalmon":
            return new Color2(new RGBA(233, 150, 122, 1));
          case "darkseagreen":
            return new Color2(new RGBA(143, 188, 143, 1));
          case "darkslateblue":
            return new Color2(new RGBA(72, 61, 139, 1));
          case "darkslategray":
            return new Color2(new RGBA(47, 79, 79, 1));
          case "darkslategrey":
            return new Color2(new RGBA(47, 79, 79, 1));
          case "darkturquoise":
            return new Color2(new RGBA(0, 206, 209, 1));
          case "darkviolet":
            return new Color2(new RGBA(148, 0, 211, 1));
          case "deeppink":
            return new Color2(new RGBA(255, 20, 147, 1));
          case "deepskyblue":
            return new Color2(new RGBA(0, 191, 255, 1));
          case "dimgray":
            return new Color2(new RGBA(105, 105, 105, 1));
          case "dimgrey":
            return new Color2(new RGBA(105, 105, 105, 1));
          case "dodgerblue":
            return new Color2(new RGBA(30, 144, 255, 1));
          case "firebrick":
            return new Color2(new RGBA(178, 34, 34, 1));
          case "floralwhite":
            return new Color2(new RGBA(255, 250, 240, 1));
          case "forestgreen":
            return new Color2(new RGBA(34, 139, 34, 1));
          case "fuchsia":
            return new Color2(new RGBA(255, 0, 255, 1));
          case "gainsboro":
            return new Color2(new RGBA(220, 220, 220, 1));
          case "ghostwhite":
            return new Color2(new RGBA(248, 248, 255, 1));
          case "gold":
            return new Color2(new RGBA(255, 215, 0, 1));
          case "goldenrod":
            return new Color2(new RGBA(218, 165, 32, 1));
          case "gray":
            return new Color2(new RGBA(128, 128, 128, 1));
          case "green":
            return new Color2(new RGBA(0, 128, 0, 1));
          case "greenyellow":
            return new Color2(new RGBA(173, 255, 47, 1));
          case "grey":
            return new Color2(new RGBA(128, 128, 128, 1));
          case "honeydew":
            return new Color2(new RGBA(240, 255, 240, 1));
          case "hotpink":
            return new Color2(new RGBA(255, 105, 180, 1));
          case "indianred":
            return new Color2(new RGBA(205, 92, 92, 1));
          case "indigo":
            return new Color2(new RGBA(75, 0, 130, 1));
          case "ivory":
            return new Color2(new RGBA(255, 255, 240, 1));
          case "khaki":
            return new Color2(new RGBA(240, 230, 140, 1));
          case "lavender":
            return new Color2(new RGBA(230, 230, 250, 1));
          case "lavenderblush":
            return new Color2(new RGBA(255, 240, 245, 1));
          case "lawngreen":
            return new Color2(new RGBA(124, 252, 0, 1));
          case "lemonchiffon":
            return new Color2(new RGBA(255, 250, 205, 1));
          case "lightblue":
            return new Color2(new RGBA(173, 216, 230, 1));
          case "lightcoral":
            return new Color2(new RGBA(240, 128, 128, 1));
          case "lightcyan":
            return new Color2(new RGBA(224, 255, 255, 1));
          case "lightgoldenrodyellow":
            return new Color2(new RGBA(250, 250, 210, 1));
          case "lightgray":
            return new Color2(new RGBA(211, 211, 211, 1));
          case "lightgreen":
            return new Color2(new RGBA(144, 238, 144, 1));
          case "lightgrey":
            return new Color2(new RGBA(211, 211, 211, 1));
          case "lightpink":
            return new Color2(new RGBA(255, 182, 193, 1));
          case "lightsalmon":
            return new Color2(new RGBA(255, 160, 122, 1));
          case "lightseagreen":
            return new Color2(new RGBA(32, 178, 170, 1));
          case "lightskyblue":
            return new Color2(new RGBA(135, 206, 250, 1));
          case "lightslategray":
            return new Color2(new RGBA(119, 136, 153, 1));
          case "lightslategrey":
            return new Color2(new RGBA(119, 136, 153, 1));
          case "lightsteelblue":
            return new Color2(new RGBA(176, 196, 222, 1));
          case "lightyellow":
            return new Color2(new RGBA(255, 255, 224, 1));
          case "lime":
            return new Color2(new RGBA(0, 255, 0, 1));
          case "limegreen":
            return new Color2(new RGBA(50, 205, 50, 1));
          case "linen":
            return new Color2(new RGBA(250, 240, 230, 1));
          case "magenta":
            return new Color2(new RGBA(255, 0, 255, 1));
          case "maroon":
            return new Color2(new RGBA(128, 0, 0, 1));
          case "mediumaquamarine":
            return new Color2(new RGBA(102, 205, 170, 1));
          case "mediumblue":
            return new Color2(new RGBA(0, 0, 205, 1));
          case "mediumorchid":
            return new Color2(new RGBA(186, 85, 211, 1));
          case "mediumpurple":
            return new Color2(new RGBA(147, 112, 219, 1));
          case "mediumseagreen":
            return new Color2(new RGBA(60, 179, 113, 1));
          case "mediumslateblue":
            return new Color2(new RGBA(123, 104, 238, 1));
          case "mediumspringgreen":
            return new Color2(new RGBA(0, 250, 154, 1));
          case "mediumturquoise":
            return new Color2(new RGBA(72, 209, 204, 1));
          case "mediumvioletred":
            return new Color2(new RGBA(199, 21, 133, 1));
          case "midnightblue":
            return new Color2(new RGBA(25, 25, 112, 1));
          case "mintcream":
            return new Color2(new RGBA(245, 255, 250, 1));
          case "mistyrose":
            return new Color2(new RGBA(255, 228, 225, 1));
          case "moccasin":
            return new Color2(new RGBA(255, 228, 181, 1));
          case "navajowhite":
            return new Color2(new RGBA(255, 222, 173, 1));
          case "navy":
            return new Color2(new RGBA(0, 0, 128, 1));
          case "oldlace":
            return new Color2(new RGBA(253, 245, 230, 1));
          case "olive":
            return new Color2(new RGBA(128, 128, 0, 1));
          case "olivedrab":
            return new Color2(new RGBA(107, 142, 35, 1));
          case "orange":
            return new Color2(new RGBA(255, 165, 0, 1));
          case "orangered":
            return new Color2(new RGBA(255, 69, 0, 1));
          case "orchid":
            return new Color2(new RGBA(218, 112, 214, 1));
          case "palegoldenrod":
            return new Color2(new RGBA(238, 232, 170, 1));
          case "palegreen":
            return new Color2(new RGBA(152, 251, 152, 1));
          case "paleturquoise":
            return new Color2(new RGBA(175, 238, 238, 1));
          case "palevioletred":
            return new Color2(new RGBA(219, 112, 147, 1));
          case "papayawhip":
            return new Color2(new RGBA(255, 239, 213, 1));
          case "peachpuff":
            return new Color2(new RGBA(255, 218, 185, 1));
          case "peru":
            return new Color2(new RGBA(205, 133, 63, 1));
          case "pink":
            return new Color2(new RGBA(255, 192, 203, 1));
          case "plum":
            return new Color2(new RGBA(221, 160, 221, 1));
          case "powderblue":
            return new Color2(new RGBA(176, 224, 230, 1));
          case "purple":
            return new Color2(new RGBA(128, 0, 128, 1));
          case "rebeccapurple":
            return new Color2(new RGBA(102, 51, 153, 1));
          case "red":
            return new Color2(new RGBA(255, 0, 0, 1));
          case "rosybrown":
            return new Color2(new RGBA(188, 143, 143, 1));
          case "royalblue":
            return new Color2(new RGBA(65, 105, 225, 1));
          case "saddlebrown":
            return new Color2(new RGBA(139, 69, 19, 1));
          case "salmon":
            return new Color2(new RGBA(250, 128, 114, 1));
          case "sandybrown":
            return new Color2(new RGBA(244, 164, 96, 1));
          case "seagreen":
            return new Color2(new RGBA(46, 139, 87, 1));
          case "seashell":
            return new Color2(new RGBA(255, 245, 238, 1));
          case "sienna":
            return new Color2(new RGBA(160, 82, 45, 1));
          case "silver":
            return new Color2(new RGBA(192, 192, 192, 1));
          case "skyblue":
            return new Color2(new RGBA(135, 206, 235, 1));
          case "slateblue":
            return new Color2(new RGBA(106, 90, 205, 1));
          case "slategray":
            return new Color2(new RGBA(112, 128, 144, 1));
          case "slategrey":
            return new Color2(new RGBA(112, 128, 144, 1));
          case "snow":
            return new Color2(new RGBA(255, 250, 250, 1));
          case "springgreen":
            return new Color2(new RGBA(0, 255, 127, 1));
          case "steelblue":
            return new Color2(new RGBA(70, 130, 180, 1));
          case "tan":
            return new Color2(new RGBA(210, 180, 140, 1));
          case "teal":
            return new Color2(new RGBA(0, 128, 128, 1));
          case "thistle":
            return new Color2(new RGBA(216, 191, 216, 1));
          case "tomato":
            return new Color2(new RGBA(255, 99, 71, 1));
          case "turquoise":
            return new Color2(new RGBA(64, 224, 208, 1));
          case "violet":
            return new Color2(new RGBA(238, 130, 238, 1));
          case "wheat":
            return new Color2(new RGBA(245, 222, 179, 1));
          case "white":
            return new Color2(new RGBA(255, 255, 255, 1));
          case "whitesmoke":
            return new Color2(new RGBA(245, 245, 245, 1));
          case "yellow":
            return new Color2(new RGBA(255, 255, 0, 1));
          case "yellowgreen":
            return new Color2(new RGBA(154, 205, 50, 1));
          default:
            return null;
        }
      }
      function parseHex(hex) {
        const length = hex.length;
        if (length === 0) {
          return null;
        }
        if (hex.charCodeAt(0) !== CharCode.Hash) {
          return null;
        }
        if (length === 7) {
          const r = 16 * _parseHexDigit(hex.charCodeAt(1)) + _parseHexDigit(hex.charCodeAt(2));
          const g = 16 * _parseHexDigit(hex.charCodeAt(3)) + _parseHexDigit(hex.charCodeAt(4));
          const b = 16 * _parseHexDigit(hex.charCodeAt(5)) + _parseHexDigit(hex.charCodeAt(6));
          return new Color2(new RGBA(r, g, b, 1));
        }
        if (length === 9) {
          const r = 16 * _parseHexDigit(hex.charCodeAt(1)) + _parseHexDigit(hex.charCodeAt(2));
          const g = 16 * _parseHexDigit(hex.charCodeAt(3)) + _parseHexDigit(hex.charCodeAt(4));
          const b = 16 * _parseHexDigit(hex.charCodeAt(5)) + _parseHexDigit(hex.charCodeAt(6));
          const a = 16 * _parseHexDigit(hex.charCodeAt(7)) + _parseHexDigit(hex.charCodeAt(8));
          return new Color2(new RGBA(r, g, b, a / 255));
        }
        if (length === 4) {
          const r = _parseHexDigit(hex.charCodeAt(1));
          const g = _parseHexDigit(hex.charCodeAt(2));
          const b = _parseHexDigit(hex.charCodeAt(3));
          return new Color2(new RGBA(16 * r + r, 16 * g + g, 16 * b + b));
        }
        if (length === 5) {
          const r = _parseHexDigit(hex.charCodeAt(1));
          const g = _parseHexDigit(hex.charCodeAt(2));
          const b = _parseHexDigit(hex.charCodeAt(3));
          const a = _parseHexDigit(hex.charCodeAt(4));
          return new Color2(new RGBA(16 * r + r, 16 * g + g, 16 * b + b, (16 * a + a) / 255));
        }
        return null;
      }
      CSS2.parseHex = parseHex;
      function _parseHexDigit(charCode) {
        switch (charCode) {
          case CharCode.Digit0:
            return 0;
          case CharCode.Digit1:
            return 1;
          case CharCode.Digit2:
            return 2;
          case CharCode.Digit3:
            return 3;
          case CharCode.Digit4:
            return 4;
          case CharCode.Digit5:
            return 5;
          case CharCode.Digit6:
            return 6;
          case CharCode.Digit7:
            return 7;
          case CharCode.Digit8:
            return 8;
          case CharCode.Digit9:
            return 9;
          case CharCode.a:
            return 10;
          case CharCode.A:
            return 10;
          case CharCode.b:
            return 11;
          case CharCode.B:
            return 11;
          case CharCode.c:
            return 12;
          case CharCode.C:
            return 12;
          case CharCode.d:
            return 13;
          case CharCode.D:
            return 13;
          case CharCode.e:
            return 14;
          case CharCode.E:
            return 14;
          case CharCode.f:
            return 15;
          case CharCode.F:
            return 15;
        }
        return 0;
      }
    })(CSS = Format2.CSS || (Format2.CSS = {}));
  })(Format = Color2.Format || (Color2.Format = {}));
})(Color || (Color = {}));
export {
  Color,
  HSLA,
  HSVA,
  RGBA
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9jb2xvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi9jaGFyQ29kZS5qcyc7XG5cbmZ1bmN0aW9uIHJvdW5kRmxvYXQobnVtYmVyOiBudW1iZXIsIGRlY2ltYWxQb2ludHM6IG51bWJlcik6IG51bWJlciB7XG5cdGNvbnN0IGRlY2ltYWwgPSBNYXRoLnBvdygxMCwgZGVjaW1hbFBvaW50cyk7XG5cdHJldHVybiBNYXRoLnJvdW5kKG51bWJlciAqIGRlY2ltYWwpIC8gZGVjaW1hbDtcbn1cblxuZXhwb3J0IGNsYXNzIFJHQkEge1xuXHRfcmdiYUJyYW5kOiB2b2lkID0gdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBSZWQ6IGludGVnZXIgaW4gWzAtMjU1XVxuXHQgKi9cblx0cmVhZG9ubHkgcjogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBHcmVlbjogaW50ZWdlciBpbiBbMC0yNTVdXG5cdCAqL1xuXHRyZWFkb25seSBnOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIEJsdWU6IGludGVnZXIgaW4gWzAtMjU1XVxuXHQgKi9cblx0cmVhZG9ubHkgYjogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBBbHBoYTogZmxvYXQgaW4gWzAtMV1cblx0ICovXG5cdHJlYWRvbmx5IGE6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihyOiBudW1iZXIsIGc6IG51bWJlciwgYjogbnVtYmVyLCBhOiBudW1iZXIgPSAxKSB7XG5cdFx0dGhpcy5yID0gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCByKSkgfCAwO1xuXHRcdHRoaXMuZyA9IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgZykpIHwgMDtcblx0XHR0aGlzLmIgPSBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIGIpKSB8IDA7XG5cdFx0dGhpcy5hID0gcm91bmRGbG9hdChNYXRoLm1heChNYXRoLm1pbigxLCBhKSwgMCksIDMpO1xuXHR9XG5cblx0c3RhdGljIGVxdWFscyhhOiBSR0JBLCBiOiBSR0JBKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGEuciA9PT0gYi5yICYmIGEuZyA9PT0gYi5nICYmIGEuYiA9PT0gYi5iICYmIGEuYSA9PT0gYi5hO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBIU0xBIHtcblxuXHRfaHNsYUJyYW5kOiB2b2lkID0gdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBIdWU6IGludGVnZXIgaW4gWzAsIDM2MF1cblx0ICovXG5cdHJlYWRvbmx5IGg6IG51bWJlcjtcblxuXHQvKipcblx0ICogU2F0dXJhdGlvbjogZmxvYXQgaW4gWzAsIDFdXG5cdCAqL1xuXHRyZWFkb25seSBzOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIEx1bWlub3NpdHk6IGZsb2F0IGluIFswLCAxXVxuXHQgKi9cblx0cmVhZG9ubHkgbDogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBBbHBoYTogZmxvYXQgaW4gWzAsIDFdXG5cdCAqL1xuXHRyZWFkb25seSBhOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoaDogbnVtYmVyLCBzOiBudW1iZXIsIGw6IG51bWJlciwgYTogbnVtYmVyKSB7XG5cdFx0dGhpcy5oID0gTWF0aC5tYXgoTWF0aC5taW4oMzYwLCBoKSwgMCkgfCAwO1xuXHRcdHRoaXMucyA9IHJvdW5kRmxvYXQoTWF0aC5tYXgoTWF0aC5taW4oMSwgcyksIDApLCAzKTtcblx0XHR0aGlzLmwgPSByb3VuZEZsb2F0KE1hdGgubWF4KE1hdGgubWluKDEsIGwpLCAwKSwgMyk7XG5cdFx0dGhpcy5hID0gcm91bmRGbG9hdChNYXRoLm1heChNYXRoLm1pbigxLCBhKSwgMCksIDMpO1xuXHR9XG5cblx0c3RhdGljIGVxdWFscyhhOiBIU0xBLCBiOiBIU0xBKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGEuaCA9PT0gYi5oICYmIGEucyA9PT0gYi5zICYmIGEubCA9PT0gYi5sICYmIGEuYSA9PT0gYi5hO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGFuIFJHQiBjb2xvciB2YWx1ZSB0byBIU0wuIENvbnZlcnNpb24gZm9ybXVsYVxuXHQgKiBhZGFwdGVkIGZyb20gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IU0xfY29sb3Jfc3BhY2UuXG5cdCAqIEFzc3VtZXMgciwgZywgYW5kIGIgYXJlIGNvbnRhaW5lZCBpbiB0aGUgc2V0IFswLCAyNTVdIGFuZFxuXHQgKiByZXR1cm5zIGggaW4gdGhlIHNldCBbMCwgMzYwXSwgcywgYW5kIGwgaW4gdGhlIHNldCBbMCwgMV0uXG5cdCAqL1xuXHRzdGF0aWMgZnJvbVJHQkEocmdiYTogUkdCQSk6IEhTTEEge1xuXHRcdGNvbnN0IHIgPSByZ2JhLnIgLyAyNTU7XG5cdFx0Y29uc3QgZyA9IHJnYmEuZyAvIDI1NTtcblx0XHRjb25zdCBiID0gcmdiYS5iIC8gMjU1O1xuXHRcdGNvbnN0IGEgPSByZ2JhLmE7XG5cblx0XHRjb25zdCBtYXggPSBNYXRoLm1heChyLCBnLCBiKTtcblx0XHRjb25zdCBtaW4gPSBNYXRoLm1pbihyLCBnLCBiKTtcblx0XHRsZXQgaCA9IDA7XG5cdFx0bGV0IHMgPSAwO1xuXHRcdGNvbnN0IGwgPSAobWluICsgbWF4KSAvIDI7XG5cdFx0Y29uc3QgY2hyb21hID0gbWF4IC0gbWluO1xuXG5cdFx0aWYgKGNocm9tYSA+IDApIHtcblx0XHRcdHMgPSBNYXRoLm1pbigobCA8PSAwLjUgPyBjaHJvbWEgLyAoMiAqIGwpIDogY2hyb21hIC8gKDIgLSAoMiAqIGwpKSksIDEpO1xuXG5cdFx0XHRzd2l0Y2ggKG1heCkge1xuXHRcdFx0XHRjYXNlIHI6IGggPSAoZyAtIGIpIC8gY2hyb21hICsgKGcgPCBiID8gNiA6IDApOyBicmVhaztcblx0XHRcdFx0Y2FzZSBnOiBoID0gKGIgLSByKSAvIGNocm9tYSArIDI7IGJyZWFrO1xuXHRcdFx0XHRjYXNlIGI6IGggPSAociAtIGcpIC8gY2hyb21hICsgNDsgYnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGggKj0gNjA7XG5cdFx0XHRoID0gTWF0aC5yb3VuZChoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBIU0xBKGgsIHMsIGwsIGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2h1ZTJyZ2IocDogbnVtYmVyLCBxOiBudW1iZXIsIHQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKHQgPCAwKSB7XG5cdFx0XHR0ICs9IDE7XG5cdFx0fVxuXHRcdGlmICh0ID4gMSkge1xuXHRcdFx0dCAtPSAxO1xuXHRcdH1cblx0XHRpZiAodCA8IDEgLyA2KSB7XG5cdFx0XHRyZXR1cm4gcCArIChxIC0gcCkgKiA2ICogdDtcblx0XHR9XG5cdFx0aWYgKHQgPCAxIC8gMikge1xuXHRcdFx0cmV0dXJuIHE7XG5cdFx0fVxuXHRcdGlmICh0IDwgMiAvIDMpIHtcblx0XHRcdHJldHVybiBwICsgKHEgLSBwKSAqICgyIC8gMyAtIHQpICogNjtcblx0XHR9XG5cdFx0cmV0dXJuIHA7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYW4gSFNMIGNvbG9yIHZhbHVlIHRvIFJHQi4gQ29udmVyc2lvbiBmb3JtdWxhXG5cdCAqIGFkYXB0ZWQgZnJvbSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0hTTF9jb2xvcl9zcGFjZS5cblx0ICogQXNzdW1lcyBoIGluIHRoZSBzZXQgWzAsIDM2MF0gcywgYW5kIGwgYXJlIGNvbnRhaW5lZCBpbiB0aGUgc2V0IFswLCAxXSBhbmRcblx0ICogcmV0dXJucyByLCBnLCBhbmQgYiBpbiB0aGUgc2V0IFswLCAyNTVdLlxuXHQgKi9cblx0c3RhdGljIHRvUkdCQShoc2xhOiBIU0xBKTogUkdCQSB7XG5cdFx0Y29uc3QgaCA9IGhzbGEuaCAvIDM2MDtcblx0XHRjb25zdCB7IHMsIGwsIGEgfSA9IGhzbGE7XG5cdFx0bGV0IHI6IG51bWJlciwgZzogbnVtYmVyLCBiOiBudW1iZXI7XG5cblx0XHRpZiAocyA9PT0gMCkge1xuXHRcdFx0ciA9IGcgPSBiID0gbDsgLy8gYWNocm9tYXRpY1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBxID0gbCA8IDAuNSA/IGwgKiAoMSArIHMpIDogbCArIHMgLSBsICogcztcblx0XHRcdGNvbnN0IHAgPSAyICogbCAtIHE7XG5cdFx0XHRyID0gSFNMQS5faHVlMnJnYihwLCBxLCBoICsgMSAvIDMpO1xuXHRcdFx0ZyA9IEhTTEEuX2h1ZTJyZ2IocCwgcSwgaCk7XG5cdFx0XHRiID0gSFNMQS5faHVlMnJnYihwLCBxLCBoIC0gMSAvIDMpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUkdCQShNYXRoLnJvdW5kKHIgKiAyNTUpLCBNYXRoLnJvdW5kKGcgKiAyNTUpLCBNYXRoLnJvdW5kKGIgKiAyNTUpLCBhKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSFNWQSB7XG5cblx0X2hzdmFCcmFuZDogdm9pZCA9IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogSHVlOiBpbnRlZ2VyIGluIFswLCAzNjBdXG5cdCAqL1xuXHRyZWFkb25seSBoOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFNhdHVyYXRpb246IGZsb2F0IGluIFswLCAxXVxuXHQgKi9cblx0cmVhZG9ubHkgczogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBWYWx1ZTogZmxvYXQgaW4gWzAsIDFdXG5cdCAqL1xuXHRyZWFkb25seSB2OiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIEFscGhhOiBmbG9hdCBpbiBbMCwgMV1cblx0ICovXG5cdHJlYWRvbmx5IGE6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvcihoOiBudW1iZXIsIHM6IG51bWJlciwgdjogbnVtYmVyLCBhOiBudW1iZXIpIHtcblx0XHR0aGlzLmggPSBNYXRoLm1heChNYXRoLm1pbigzNjAsIGgpLCAwKSB8IDA7XG5cdFx0dGhpcy5zID0gcm91bmRGbG9hdChNYXRoLm1heChNYXRoLm1pbigxLCBzKSwgMCksIDMpO1xuXHRcdHRoaXMudiA9IHJvdW5kRmxvYXQoTWF0aC5tYXgoTWF0aC5taW4oMSwgdiksIDApLCAzKTtcblx0XHR0aGlzLmEgPSByb3VuZEZsb2F0KE1hdGgubWF4KE1hdGgubWluKDEsIGEpLCAwKSwgMyk7XG5cdH1cblxuXHRzdGF0aWMgZXF1YWxzKGE6IEhTVkEsIGI6IEhTVkEpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gYS5oID09PSBiLmggJiYgYS5zID09PSBiLnMgJiYgYS52ID09PSBiLnYgJiYgYS5hID09PSBiLmE7XG5cdH1cblxuXHQvLyBmcm9tIGh0dHA6Ly93d3cucmFwaWR0YWJsZXMuY29tL2NvbnZlcnQvY29sb3IvcmdiLXRvLWhzdi5odG1cblx0c3RhdGljIGZyb21SR0JBKHJnYmE6IFJHQkEpOiBIU1ZBIHtcblx0XHRjb25zdCByID0gcmdiYS5yIC8gMjU1O1xuXHRcdGNvbnN0IGcgPSByZ2JhLmcgLyAyNTU7XG5cdFx0Y29uc3QgYiA9IHJnYmEuYiAvIDI1NTtcblx0XHRjb25zdCBjbWF4ID0gTWF0aC5tYXgociwgZywgYik7XG5cdFx0Y29uc3QgY21pbiA9IE1hdGgubWluKHIsIGcsIGIpO1xuXHRcdGNvbnN0IGRlbHRhID0gY21heCAtIGNtaW47XG5cdFx0Y29uc3QgcyA9IGNtYXggPT09IDAgPyAwIDogKGRlbHRhIC8gY21heCk7XG5cdFx0bGV0IG06IG51bWJlcjtcblxuXHRcdGlmIChkZWx0YSA9PT0gMCkge1xuXHRcdFx0bSA9IDA7XG5cdFx0fSBlbHNlIGlmIChjbWF4ID09PSByKSB7XG5cdFx0XHRtID0gKCgoKGcgLSBiKSAvIGRlbHRhKSAlIDYpICsgNikgJSA2O1xuXHRcdH0gZWxzZSBpZiAoY21heCA9PT0gZykge1xuXHRcdFx0bSA9ICgoYiAtIHIpIC8gZGVsdGEpICsgMjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bSA9ICgociAtIGcpIC8gZGVsdGEpICsgNDtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IEhTVkEoTWF0aC5yb3VuZChtICogNjApLCBzLCBjbWF4LCByZ2JhLmEpO1xuXHR9XG5cblx0Ly8gZnJvbSBodHRwOi8vd3d3LnJhcGlkdGFibGVzLmNvbS9jb252ZXJ0L2NvbG9yL2hzdi10by1yZ2IuaHRtXG5cdHN0YXRpYyB0b1JHQkEoaHN2YTogSFNWQSk6IFJHQkEge1xuXHRcdGNvbnN0IHsgaCwgcywgdiwgYSB9ID0gaHN2YTtcblx0XHRjb25zdCBjID0gdiAqIHM7XG5cdFx0Y29uc3QgeCA9IGMgKiAoMSAtIE1hdGguYWJzKChoIC8gNjApICUgMiAtIDEpKTtcblx0XHRjb25zdCBtID0gdiAtIGM7XG5cdFx0bGV0IFtyLCBnLCBiXSA9IFswLCAwLCAwXTtcblxuXHRcdGlmIChoIDwgNjApIHtcblx0XHRcdHIgPSBjO1xuXHRcdFx0ZyA9IHg7XG5cdFx0fSBlbHNlIGlmIChoIDwgMTIwKSB7XG5cdFx0XHRyID0geDtcblx0XHRcdGcgPSBjO1xuXHRcdH0gZWxzZSBpZiAoaCA8IDE4MCkge1xuXHRcdFx0ZyA9IGM7XG5cdFx0XHRiID0geDtcblx0XHR9IGVsc2UgaWYgKGggPCAyNDApIHtcblx0XHRcdGcgPSB4O1xuXHRcdFx0YiA9IGM7XG5cdFx0fSBlbHNlIGlmIChoIDwgMzAwKSB7XG5cdFx0XHRyID0geDtcblx0XHRcdGIgPSBjO1xuXHRcdH0gZWxzZSBpZiAoaCA8PSAzNjApIHtcblx0XHRcdHIgPSBjO1xuXHRcdFx0YiA9IHg7XG5cdFx0fVxuXG5cdFx0ciA9IE1hdGgucm91bmQoKHIgKyBtKSAqIDI1NSk7XG5cdFx0ZyA9IE1hdGgucm91bmQoKGcgKyBtKSAqIDI1NSk7XG5cdFx0YiA9IE1hdGgucm91bmQoKGIgKyBtKSAqIDI1NSk7XG5cblx0XHRyZXR1cm4gbmV3IFJHQkEociwgZywgYiwgYSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbG9yIHtcblxuXHRzdGF0aWMgZnJvbUhleChoZXg6IHN0cmluZyk6IENvbG9yIHtcblx0XHRyZXR1cm4gQ29sb3IuRm9ybWF0LkNTUy5wYXJzZUhleChoZXgpIHx8IENvbG9yLnJlZDtcblx0fVxuXG5cdHN0YXRpYyBlcXVhbHMoYTogQ29sb3IgfCBudWxsLCBiOiBDb2xvciB8IG51bGwpOiBib29sZWFuIHtcblx0XHRpZiAoIWEgJiYgIWIpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIWEgfHwgIWIpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIGEuZXF1YWxzKGIpO1xuXHR9XG5cblx0cmVhZG9ubHkgcmdiYTogUkdCQTtcblx0cHJpdmF0ZSBfaHNsYT86IEhTTEE7XG5cdGdldCBoc2xhKCk6IEhTTEEge1xuXHRcdGlmICh0aGlzLl9oc2xhKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5faHNsYTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIEhTTEEuZnJvbVJHQkEodGhpcy5yZ2JhKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9oc3ZhPzogSFNWQTtcblx0Z2V0IGhzdmEoKTogSFNWQSB7XG5cdFx0aWYgKHRoaXMuX2hzdmEpIHtcblx0XHRcdHJldHVybiB0aGlzLl9oc3ZhO1xuXHRcdH1cblx0XHRyZXR1cm4gSFNWQS5mcm9tUkdCQSh0aGlzLnJnYmEpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoYXJnOiBSR0JBIHwgSFNMQSB8IEhTVkEpIHtcblx0XHRpZiAoIWFyZykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDb2xvciBuZWVkcyBhIHZhbHVlJyk7XG5cdFx0fSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBSR0JBKSB7XG5cdFx0XHR0aGlzLnJnYmEgPSBhcmc7XG5cdFx0fSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBIU0xBKSB7XG5cdFx0XHR0aGlzLl9oc2xhID0gYXJnO1xuXHRcdFx0dGhpcy5yZ2JhID0gSFNMQS50b1JHQkEoYXJnKTtcblx0XHR9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIEhTVkEpIHtcblx0XHRcdHRoaXMuX2hzdmEgPSBhcmc7XG5cdFx0XHR0aGlzLnJnYmEgPSBIU1ZBLnRvUkdCQShhcmcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29sb3IgY3RvciBhcmd1bWVudCcpO1xuXHRcdH1cblx0fVxuXG5cdGVxdWFscyhvdGhlcjogQ29sb3IgfCBudWxsKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhb3RoZXIgJiYgUkdCQS5lcXVhbHModGhpcy5yZ2JhLCBvdGhlci5yZ2JhKSAmJiBIU0xBLmVxdWFscyh0aGlzLmhzbGEsIG90aGVyLmhzbGEpICYmIEhTVkEuZXF1YWxzKHRoaXMuaHN2YSwgb3RoZXIuaHN2YSk7XG5cdH1cblxuXHQvKipcblx0ICogaHR0cDovL3d3dy53My5vcmcvVFIvV0NBRzIwLyNyZWxhdGl2ZWx1bWluYW5jZWRlZlxuXHQgKiBSZXR1cm5zIHRoZSBudW1iZXIgaW4gdGhlIHNldCBbMCwgMV0uIE8gPT4gRGFya2VzdCBCbGFjay4gMSA9PiBMaWdodGVzdCB3aGl0ZS5cblx0ICovXG5cdGdldFJlbGF0aXZlTHVtaW5hbmNlKCk6IG51bWJlciB7XG5cdFx0Y29uc3QgUiA9IENvbG9yLl9yZWxhdGl2ZUx1bWluYW5jZUZvckNvbXBvbmVudCh0aGlzLnJnYmEucik7XG5cdFx0Y29uc3QgRyA9IENvbG9yLl9yZWxhdGl2ZUx1bWluYW5jZUZvckNvbXBvbmVudCh0aGlzLnJnYmEuZyk7XG5cdFx0Y29uc3QgQiA9IENvbG9yLl9yZWxhdGl2ZUx1bWluYW5jZUZvckNvbXBvbmVudCh0aGlzLnJnYmEuYik7XG5cdFx0Y29uc3QgbHVtaW5hbmNlID0gMC4yMTI2ICogUiArIDAuNzE1MiAqIEcgKyAwLjA3MjIgKiBCO1xuXG5cdFx0cmV0dXJuIHJvdW5kRmxvYXQobHVtaW5hbmNlLCA0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWR1Y2VzIHRoZSBcImZvcmVncm91bmRcIiBjb2xvciBvbiB0aGlzIFwiYmFja2dyb3VuZFwiIGNvbG9yIHVudGkgaXQgaXNcblx0ICogYmVsb3cgdGhlIHJlbGF0aXZlIGx1bWluYWNlIHJhdGlvLlxuXHQgKiBAcmV0dXJucyB0aGUgbmV3IGZvcmVncm91bmQgY29sb3Jcblx0ICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20veHRlcm1qcy94dGVybS5qcy9ibG9iLzQ0ZjlmYTM5YWUwM2UyY2E2ZDI4MzU0ZDg4YTM5OTYwODY4Njc3MGUvc3JjL2NvbW1vbi9Db2xvci50cyNMMzE1XG5cdCAqL1xuXHRyZWR1Y2VSZWxhdGl2ZUx1bWluYWNlKGZvcmVncm91bmQ6IENvbG9yLCByYXRpbzogbnVtYmVyKTogQ29sb3Ige1xuXHRcdC8vIFRoaXMgaXMgYSBuYWl2ZSBidXQgZmFzdCBhcHByb2FjaCB0byByZWR1Y2luZyBsdW1pbmFuY2UgYXMgY29udmVydGluZyB0b1xuXHRcdC8vIEhTTCBhbmQgYmFjayBpcyBleHBlbnNpdmVcblx0XHRsZXQgeyByOiBmZ1IsIGc6IGZnRywgYjogZmdCIH0gPSBmb3JlZ3JvdW5kLnJnYmE7XG5cblx0XHRsZXQgY3IgPSB0aGlzLmdldENvbnRyYXN0UmF0aW8oZm9yZWdyb3VuZCk7XG5cdFx0d2hpbGUgKGNyIDwgcmF0aW8gJiYgKGZnUiA+IDAgfHwgZmdHID4gMCB8fCBmZ0IgPiAwKSkge1xuXHRcdFx0Ly8gUmVkdWNlIGJ5IDEwJSB1bnRpbCB0aGUgcmF0aW8gaXMgaGl0XG5cdFx0XHRmZ1IgLT0gTWF0aC5tYXgoMCwgTWF0aC5jZWlsKGZnUiAqIDAuMSkpO1xuXHRcdFx0ZmdHIC09IE1hdGgubWF4KDAsIE1hdGguY2VpbChmZ0cgKiAwLjEpKTtcblx0XHRcdGZnQiAtPSBNYXRoLm1heCgwLCBNYXRoLmNlaWwoZmdCICogMC4xKSk7XG5cdFx0XHRjciA9IHRoaXMuZ2V0Q29udHJhc3RSYXRpbyhuZXcgQ29sb3IobmV3IFJHQkEoZmdSLCBmZ0csIGZnQikpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKGZnUiwgZmdHLCBmZ0IpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbmNyZWFzZXMgdGhlIFwiZm9yZWdyb3VuZFwiIGNvbG9yIG9uIHRoaXMgXCJiYWNrZ3JvdW5kXCIgY29sb3IgdW50aSBpdCBpc1xuXHQgKiBiZWxvdyB0aGUgcmVsYXRpdmUgbHVtaW5hY2UgcmF0aW8uXG5cdCAqIEByZXR1cm5zIHRoZSBuZXcgZm9yZWdyb3VuZCBjb2xvclxuXHQgKiBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS94dGVybWpzL3h0ZXJtLmpzL2Jsb2IvNDRmOWZhMzlhZTAzZTJjYTZkMjgzNTRkODhhMzk5NjA4Njg2NzcwZS9zcmMvY29tbW9uL0NvbG9yLnRzI0wzMzVcblx0ICovXG5cdGluY3JlYXNlUmVsYXRpdmVMdW1pbmFjZShmb3JlZ3JvdW5kOiBDb2xvciwgcmF0aW86IG51bWJlcik6IENvbG9yIHtcblx0XHQvLyBUaGlzIGlzIGEgbmFpdmUgYnV0IGZhc3QgYXBwcm9hY2ggdG8gcmVkdWNpbmcgbHVtaW5hbmNlIGFzIGNvbnZlcnRpbmcgdG9cblx0XHQvLyBIU0wgYW5kIGJhY2sgaXMgZXhwZW5zaXZlXG5cdFx0bGV0IHsgcjogZmdSLCBnOiBmZ0csIGI6IGZnQiB9ID0gZm9yZWdyb3VuZC5yZ2JhO1xuXHRcdGxldCBjciA9IHRoaXMuZ2V0Q29udHJhc3RSYXRpbyhmb3JlZ3JvdW5kKTtcblx0XHR3aGlsZSAoY3IgPCByYXRpbyAmJiAoZmdSIDwgMHhGRiB8fCBmZ0cgPCAweEZGIHx8IGZnQiA8IDB4RkYpKSB7XG5cdFx0XHRmZ1IgPSBNYXRoLm1pbigweEZGLCBmZ1IgKyBNYXRoLmNlaWwoKDI1NSAtIGZnUikgKiAwLjEpKTtcblx0XHRcdGZnRyA9IE1hdGgubWluKDB4RkYsIGZnRyArIE1hdGguY2VpbCgoMjU1IC0gZmdHKSAqIDAuMSkpO1xuXHRcdFx0ZmdCID0gTWF0aC5taW4oMHhGRiwgZmdCICsgTWF0aC5jZWlsKCgyNTUgLSBmZ0IpICogMC4xKSk7XG5cdFx0XHRjciA9IHRoaXMuZ2V0Q29udHJhc3RSYXRpbyhuZXcgQ29sb3IobmV3IFJHQkEoZmdSLCBmZ0csIGZnQikpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKGZnUiwgZmdHLCBmZ0IpKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9yZWxhdGl2ZUx1bWluYW5jZUZvckNvbXBvbmVudChjb2xvcjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRjb25zdCBjID0gY29sb3IgLyAyNTU7XG5cdFx0cmV0dXJuIChjIDw9IDAuMDM5MjgpID8gYyAvIDEyLjkyIDogTWF0aC5wb3coKChjICsgMC4wNTUpIC8gMS4wNTUpLCAyLjQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIGh0dHA6Ly93d3cudzMub3JnL1RSL1dDQUcyMC8jY29udHJhc3QtcmF0aW9kZWZcblx0ICogUmV0dXJucyB0aGUgY29udHJhc3QgcmF0aW9uIG51bWJlciBpbiB0aGUgc2V0IFsxLCAyMV0uXG5cdCAqL1xuXHRnZXRDb250cmFzdFJhdGlvKGFub3RoZXI6IENvbG9yKTogbnVtYmVyIHtcblx0XHRjb25zdCBsdW0xID0gdGhpcy5nZXRSZWxhdGl2ZUx1bWluYW5jZSgpO1xuXHRcdGNvbnN0IGx1bTIgPSBhbm90aGVyLmdldFJlbGF0aXZlTHVtaW5hbmNlKCk7XG5cdFx0cmV0dXJuIGx1bTEgPiBsdW0yID8gKGx1bTEgKyAwLjA1KSAvIChsdW0yICsgMC4wNSkgOiAobHVtMiArIDAuMDUpIC8gKGx1bTEgKyAwLjA1KTtcblx0fVxuXG5cdC8qKlxuXHQgKlx0aHR0cDovLzI0d2F5cy5vcmcvMjAxMC9jYWxjdWxhdGluZy1jb2xvci1jb250cmFzdFxuXHQgKiAgUmV0dXJuICd0cnVlJyBpZiBkYXJrZXIgY29sb3Igb3RoZXJ3aXNlICdmYWxzZSdcblx0ICovXG5cdGlzRGFya2VyKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHlpcSA9ICh0aGlzLnJnYmEuciAqIDI5OSArIHRoaXMucmdiYS5nICogNTg3ICsgdGhpcy5yZ2JhLmIgKiAxMTQpIC8gMTAwMDtcblx0XHRyZXR1cm4geWlxIDwgMTI4O1xuXHR9XG5cblx0LyoqXG5cdCAqXHRodHRwOi8vMjR3YXlzLm9yZy8yMDEwL2NhbGN1bGF0aW5nLWNvbG9yLWNvbnRyYXN0XG5cdCAqICBSZXR1cm4gJ3RydWUnIGlmIGxpZ2h0ZXIgY29sb3Igb3RoZXJ3aXNlICdmYWxzZSdcblx0ICovXG5cdGlzTGlnaHRlcigpOiBib29sZWFuIHtcblx0XHRjb25zdCB5aXEgPSAodGhpcy5yZ2JhLnIgKiAyOTkgKyB0aGlzLnJnYmEuZyAqIDU4NyArIHRoaXMucmdiYS5iICogMTE0KSAvIDEwMDA7XG5cdFx0cmV0dXJuIHlpcSA+PSAxMjg7XG5cdH1cblxuXHRpc0xpZ2h0ZXJUaGFuKGFub3RoZXI6IENvbG9yKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgbHVtMSA9IHRoaXMuZ2V0UmVsYXRpdmVMdW1pbmFuY2UoKTtcblx0XHRjb25zdCBsdW0yID0gYW5vdGhlci5nZXRSZWxhdGl2ZUx1bWluYW5jZSgpO1xuXHRcdHJldHVybiBsdW0xID4gbHVtMjtcblx0fVxuXG5cdGlzRGFya2VyVGhhbihhbm90aGVyOiBDb2xvcik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGx1bTEgPSB0aGlzLmdldFJlbGF0aXZlTHVtaW5hbmNlKCk7XG5cdFx0Y29uc3QgbHVtMiA9IGFub3RoZXIuZ2V0UmVsYXRpdmVMdW1pbmFuY2UoKTtcblx0XHRyZXR1cm4gbHVtMSA8IGx1bTI7XG5cdH1cblxuXHQvKipcblx0ICogQmFzZWQgb24geHRlcm0uanM6IGh0dHBzOi8vZ2l0aHViLmNvbS94dGVybWpzL3h0ZXJtLmpzL2Jsb2IvNDRmOWZhMzlhZTAzZTJjYTZkMjgzNTRkODhhMzk5NjA4Njg2NzcwZS9zcmMvY29tbW9uL0NvbG9yLnRzI0wyODhcblx0ICpcblx0ICogR2l2ZW4gYSBmb3JlZ3JvdW5kIGNvbG9yIGFuZCBhIGJhY2tncm91bmQgY29sb3IsIGVpdGhlciBpbmNyZWFzZSBvciByZWR1Y2UgdGhlIGx1bWluYW5jZSBvZiB0aGVcblx0ICogZm9yZWdyb3VuZCBjb2xvciB1bnRpbCB0aGUgc3BlY2lmaWVkIGNvbnRyYXN0IHJhdGlvIGlzIG1ldC4gSWYgcHVyZSB3aGl0ZSBvciBibGFjayBpcyBoaXRcblx0ICogd2l0aG91dCB0aGUgY29udHJhc3QgcmF0aW8gYmVpbmcgbWV0LCBnbyB0aGUgb3RoZXIgZGlyZWN0aW9uIHVzaW5nIHRoZSBiYWNrZ3JvdW5kIGNvbG9yIGFzIHRoZVxuXHQgKiBmb3JlZ3JvdW5kIGNvbG9yIGFuZCB0YWtlIGVpdGhlciB0aGUgZmlyc3Qgb3Igc2Vjb25kIHJlc3VsdCBkZXBlbmRpbmcgb24gd2hpY2ggaGFzIHRoZSBoaWdoZXJcblx0ICogY29udHJhc3QgcmF0aW8uXG5cdCAqXG5cdCAqIEBwYXJhbSBmb3JlZ3JvdW5kIFRoZSBmb3JlZ3JvdW5kIGNvbG9yLlxuXHQgKiBAcGFyYW0gcmF0aW8gVGhlIGNvbnRyYXN0IHJhdGlvIHRvIGFjaGlldmUuXG5cdCAqIEByZXR1cm5zIFRoZSBhZGp1c3RlZCBmb3JlZ3JvdW5kIGNvbG9yLlxuXHQgKi9cblx0ZW5zdXJlQ29uc3RyYXN0KGZvcmVncm91bmQ6IENvbG9yLCByYXRpbzogbnVtYmVyKTogQ29sb3Ige1xuXHRcdGNvbnN0IGJnTCA9IHRoaXMuZ2V0UmVsYXRpdmVMdW1pbmFuY2UoKTtcblx0XHRjb25zdCBmZ0wgPSBmb3JlZ3JvdW5kLmdldFJlbGF0aXZlTHVtaW5hbmNlKCk7XG5cdFx0Y29uc3QgY3IgPSB0aGlzLmdldENvbnRyYXN0UmF0aW8oZm9yZWdyb3VuZCk7XG5cdFx0aWYgKGNyIDwgcmF0aW8pIHtcblx0XHRcdGlmIChmZ0wgPCBiZ0wpIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0QSA9IHRoaXMucmVkdWNlUmVsYXRpdmVMdW1pbmFjZShmb3JlZ3JvdW5kLCByYXRpbyk7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdEFSYXRpbyA9IHRoaXMuZ2V0Q29udHJhc3RSYXRpbyhyZXN1bHRBKTtcblx0XHRcdFx0aWYgKHJlc3VsdEFSYXRpbyA8IHJhdGlvKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0QiA9IHRoaXMuaW5jcmVhc2VSZWxhdGl2ZUx1bWluYWNlKGZvcmVncm91bmQsIHJhdGlvKTtcblx0XHRcdFx0XHRjb25zdCByZXN1bHRCUmF0aW8gPSB0aGlzLmdldENvbnRyYXN0UmF0aW8ocmVzdWx0Qik7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdEFSYXRpbyA+IHJlc3VsdEJSYXRpbyA/IHJlc3VsdEEgOiByZXN1bHRCO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHRBO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVzdWx0QSA9IHRoaXMuaW5jcmVhc2VSZWxhdGl2ZUx1bWluYWNlKGZvcmVncm91bmQsIHJhdGlvKTtcblx0XHRcdGNvbnN0IHJlc3VsdEFSYXRpbyA9IHRoaXMuZ2V0Q29udHJhc3RSYXRpbyhyZXN1bHRBKTtcblx0XHRcdGlmIChyZXN1bHRBUmF0aW8gPCByYXRpbykge1xuXHRcdFx0XHRjb25zdCByZXN1bHRCID0gdGhpcy5yZWR1Y2VSZWxhdGl2ZUx1bWluYWNlKGZvcmVncm91bmQsIHJhdGlvKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0QlJhdGlvID0gdGhpcy5nZXRDb250cmFzdFJhdGlvKHJlc3VsdEIpO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0QVJhdGlvID4gcmVzdWx0QlJhdGlvID8gcmVzdWx0QSA6IHJlc3VsdEI7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0QTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZm9yZWdyb3VuZDtcblx0fVxuXG5cdGxpZ2h0ZW4oZmFjdG9yOiBudW1iZXIpOiBDb2xvciB7XG5cdFx0cmV0dXJuIG5ldyBDb2xvcihuZXcgSFNMQSh0aGlzLmhzbGEuaCwgdGhpcy5oc2xhLnMsIHRoaXMuaHNsYS5sICsgdGhpcy5oc2xhLmwgKiBmYWN0b3IsIHRoaXMuaHNsYS5hKSk7XG5cdH1cblxuXHRkYXJrZW4oZmFjdG9yOiBudW1iZXIpOiBDb2xvciB7XG5cdFx0cmV0dXJuIG5ldyBDb2xvcihuZXcgSFNMQSh0aGlzLmhzbGEuaCwgdGhpcy5oc2xhLnMsIHRoaXMuaHNsYS5sIC0gdGhpcy5oc2xhLmwgKiBmYWN0b3IsIHRoaXMuaHNsYS5hKSk7XG5cdH1cblxuXHR0cmFuc3BhcmVudChmYWN0b3I6IG51bWJlcik6IENvbG9yIHtcblx0XHRjb25zdCB7IHIsIGcsIGIsIGEgfSA9IHRoaXMucmdiYTtcblx0XHRyZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKHIsIGcsIGIsIGEgKiBmYWN0b3IpKTtcblx0fVxuXG5cdGlzVHJhbnNwYXJlbnQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMucmdiYS5hID09PSAwO1xuXHR9XG5cblx0aXNPcGFxdWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMucmdiYS5hID09PSAxO1xuXHR9XG5cblx0b3Bwb3NpdGUoKTogQ29sb3Ige1xuXHRcdHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1IC0gdGhpcy5yZ2JhLnIsIDI1NSAtIHRoaXMucmdiYS5nLCAyNTUgLSB0aGlzLnJnYmEuYiwgdGhpcy5yZ2JhLmEpKTtcblx0fVxuXG5cdGJsZW5kKGM6IENvbG9yKTogQ29sb3Ige1xuXHRcdGNvbnN0IHJnYmEgPSBjLnJnYmE7XG5cblx0XHQvLyBDb252ZXJ0IHRvIDAuLjEgb3BhY2l0eVxuXHRcdGNvbnN0IHRoaXNBID0gdGhpcy5yZ2JhLmE7XG5cdFx0Y29uc3QgY29sb3JBID0gcmdiYS5hO1xuXG5cdFx0Y29uc3QgYSA9IHRoaXNBICsgY29sb3JBICogKDEgLSB0aGlzQSk7XG5cdFx0aWYgKGEgPCAxZS02KSB7XG5cdFx0XHRyZXR1cm4gQ29sb3IudHJhbnNwYXJlbnQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgciA9IHRoaXMucmdiYS5yICogdGhpc0EgLyBhICsgcmdiYS5yICogY29sb3JBICogKDEgLSB0aGlzQSkgLyBhO1xuXHRcdGNvbnN0IGcgPSB0aGlzLnJnYmEuZyAqIHRoaXNBIC8gYSArIHJnYmEuZyAqIGNvbG9yQSAqICgxIC0gdGhpc0EpIC8gYTtcblx0XHRjb25zdCBiID0gdGhpcy5yZ2JhLmIgKiB0aGlzQSAvIGEgKyByZ2JhLmIgKiBjb2xvckEgKiAoMSAtIHRoaXNBKSAvIGE7XG5cblx0XHRyZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKHIsIGcsIGIsIGEpKTtcblx0fVxuXG5cdG1ha2VPcGFxdWUob3BhcXVlQmFja2dyb3VuZDogQ29sb3IpOiBDb2xvciB7XG5cdFx0aWYgKHRoaXMuaXNPcGFxdWUoKSB8fCBvcGFxdWVCYWNrZ3JvdW5kLnJnYmEuYSAhPT0gMSkge1xuXHRcdFx0Ly8gb25seSBhbGxvdyB0byBibGVuZCBvbnRvIGEgbm9uLW9wYXF1ZSBjb2xvciBvbnRvIGEgb3BhcXVlIGNvbG9yXG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHRjb25zdCB7IHIsIGcsIGIsIGEgfSA9IHRoaXMucmdiYTtcblxuXHRcdC8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzEyMjI4NTQ4L2ZpbmRpbmctZXF1aXZhbGVudC1jb2xvci13aXRoLW9wYWNpdHlcblx0XHRyZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKFxuXHRcdFx0b3BhcXVlQmFja2dyb3VuZC5yZ2JhLnIgLSBhICogKG9wYXF1ZUJhY2tncm91bmQucmdiYS5yIC0gciksXG5cdFx0XHRvcGFxdWVCYWNrZ3JvdW5kLnJnYmEuZyAtIGEgKiAob3BhcXVlQmFja2dyb3VuZC5yZ2JhLmcgLSBnKSxcblx0XHRcdG9wYXF1ZUJhY2tncm91bmQucmdiYS5iIC0gYSAqIChvcGFxdWVCYWNrZ3JvdW5kLnJnYmEuYiAtIGIpLFxuXHRcdFx0MVxuXHRcdCkpO1xuXHR9XG5cblx0ZmxhdHRlbiguLi5iYWNrZ3JvdW5kczogQ29sb3JbXSk6IENvbG9yIHtcblx0XHRjb25zdCBiYWNrZ3JvdW5kID0gYmFja2dyb3VuZHMucmVkdWNlUmlnaHQoKGFjY3VtdWxhdG9yLCBjb2xvcikgPT4ge1xuXHRcdFx0cmV0dXJuIENvbG9yLl9mbGF0dGVuKGNvbG9yLCBhY2N1bXVsYXRvcik7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIENvbG9yLl9mbGF0dGVuKHRoaXMsIGJhY2tncm91bmQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2ZsYXR0ZW4oZm9yZWdyb3VuZDogQ29sb3IsIGJhY2tncm91bmQ6IENvbG9yKSB7XG5cdFx0Y29uc3QgYmFja2dyb3VuZEFscGhhID0gMSAtIGZvcmVncm91bmQucmdiYS5hO1xuXHRcdHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoXG5cdFx0XHRiYWNrZ3JvdW5kQWxwaGEgKiBiYWNrZ3JvdW5kLnJnYmEuciArIGZvcmVncm91bmQucmdiYS5hICogZm9yZWdyb3VuZC5yZ2JhLnIsXG5cdFx0XHRiYWNrZ3JvdW5kQWxwaGEgKiBiYWNrZ3JvdW5kLnJnYmEuZyArIGZvcmVncm91bmQucmdiYS5hICogZm9yZWdyb3VuZC5yZ2JhLmcsXG5cdFx0XHRiYWNrZ3JvdW5kQWxwaGEgKiBiYWNrZ3JvdW5kLnJnYmEuYiArIGZvcmVncm91bmQucmdiYS5hICogZm9yZWdyb3VuZC5yZ2JhLmJcblx0XHQpKTtcblx0fVxuXG5cdHByaXZhdGUgX3RvU3RyaW5nPzogc3RyaW5nO1xuXHR0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdGlmICghdGhpcy5fdG9TdHJpbmcpIHtcblx0XHRcdHRoaXMuX3RvU3RyaW5nID0gQ29sb3IuRm9ybWF0LkNTUy5mb3JtYXQodGhpcyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90b1N0cmluZztcblx0fVxuXG5cdHByaXZhdGUgX3RvTnVtYmVyMzJCaXQ/OiBudW1iZXI7XG5cdHRvTnVtYmVyMzJCaXQoKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuX3RvTnVtYmVyMzJCaXQpIHtcblx0XHRcdHRoaXMuX3RvTnVtYmVyMzJCaXQgPSAoXG5cdFx0XHRcdHRoaXMucmdiYS5yIC8qICAqLyA8PCAyNCB8XG5cdFx0XHRcdHRoaXMucmdiYS5nIC8qICAqLyA8PCAxNiB8XG5cdFx0XHRcdHRoaXMucmdiYS5iIC8qICAqLyA8PCA4IHxcblx0XHRcdFx0dGhpcy5yZ2JhLmEgKiAweEZGIDw8IDBcblx0XHRcdCkgPj4+IDA7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90b051bWJlcjMyQml0O1xuXHR9XG5cblx0c3RhdGljIGdldExpZ2h0ZXJDb2xvcihvZjogQ29sb3IsIHJlbGF0aXZlOiBDb2xvciwgZmFjdG9yPzogbnVtYmVyKTogQ29sb3Ige1xuXHRcdGlmIChvZi5pc0xpZ2h0ZXJUaGFuKHJlbGF0aXZlKSkge1xuXHRcdFx0cmV0dXJuIG9mO1xuXHRcdH1cblx0XHRmYWN0b3IgPSBmYWN0b3IgPyBmYWN0b3IgOiAwLjU7XG5cdFx0Y29uc3QgbHVtMSA9IG9mLmdldFJlbGF0aXZlTHVtaW5hbmNlKCk7XG5cdFx0Y29uc3QgbHVtMiA9IHJlbGF0aXZlLmdldFJlbGF0aXZlTHVtaW5hbmNlKCk7XG5cdFx0ZmFjdG9yID0gZmFjdG9yICogKGx1bTIgLSBsdW0xKSAvIGx1bTI7XG5cdFx0cmV0dXJuIG9mLmxpZ2h0ZW4oZmFjdG9yKTtcblx0fVxuXG5cdHN0YXRpYyBnZXREYXJrZXJDb2xvcihvZjogQ29sb3IsIHJlbGF0aXZlOiBDb2xvciwgZmFjdG9yPzogbnVtYmVyKTogQ29sb3Ige1xuXHRcdGlmIChvZi5pc0RhcmtlclRoYW4ocmVsYXRpdmUpKSB7XG5cdFx0XHRyZXR1cm4gb2Y7XG5cdFx0fVxuXHRcdGZhY3RvciA9IGZhY3RvciA/IGZhY3RvciA6IDAuNTtcblx0XHRjb25zdCBsdW0xID0gb2YuZ2V0UmVsYXRpdmVMdW1pbmFuY2UoKTtcblx0XHRjb25zdCBsdW0yID0gcmVsYXRpdmUuZ2V0UmVsYXRpdmVMdW1pbmFuY2UoKTtcblx0XHRmYWN0b3IgPSBmYWN0b3IgKiAobHVtMSAtIGx1bTIpIC8gbHVtMTtcblx0XHRyZXR1cm4gb2YuZGFya2VuKGZhY3Rvcik7XG5cdH1cblxuXHRzdGF0aWMgcmVhZG9ubHkgd2hpdGUgPSBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAyNTUsIDI1NSwgMSkpO1xuXHRzdGF0aWMgcmVhZG9ubHkgYmxhY2sgPSBuZXcgQ29sb3IobmV3IFJHQkEoMCwgMCwgMCwgMSkpO1xuXHRzdGF0aWMgcmVhZG9ubHkgcmVkID0gbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgMCwgMCwgMSkpO1xuXHRzdGF0aWMgcmVhZG9ubHkgYmx1ZSA9IG5ldyBDb2xvcihuZXcgUkdCQSgwLCAwLCAyNTUsIDEpKTtcblx0c3RhdGljIHJlYWRvbmx5IGdyZWVuID0gbmV3IENvbG9yKG5ldyBSR0JBKDAsIDI1NSwgMCwgMSkpO1xuXHRzdGF0aWMgcmVhZG9ubHkgY3lhbiA9IG5ldyBDb2xvcihuZXcgUkdCQSgwLCAyNTUsIDI1NSwgMSkpO1xuXHRzdGF0aWMgcmVhZG9ubHkgbGlnaHRncmV5ID0gbmV3IENvbG9yKG5ldyBSR0JBKDIxMSwgMjExLCAyMTEsIDEpKTtcblx0c3RhdGljIHJlYWRvbmx5IHRyYW5zcGFyZW50ID0gbmV3IENvbG9yKG5ldyBSR0JBKDAsIDAsIDAsIDApKTtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDb2xvciB7XG5cdGV4cG9ydCBuYW1lc3BhY2UgRm9ybWF0IHtcblx0XHRleHBvcnQgbmFtZXNwYWNlIENTUyB7XG5cblx0XHRcdGV4cG9ydCBmdW5jdGlvbiBmb3JtYXRSR0IoY29sb3I6IENvbG9yKTogc3RyaW5nIHtcblx0XHRcdFx0aWYgKGNvbG9yLnJnYmEuYSA9PT0gMSkge1xuXHRcdFx0XHRcdHJldHVybiBgcmdiKCR7Y29sb3IucmdiYS5yfSwgJHtjb2xvci5yZ2JhLmd9LCAke2NvbG9yLnJnYmEuYn0pYDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdFJHQkEoY29sb3IpO1xuXHRcdFx0fVxuXG5cdFx0XHRleHBvcnQgZnVuY3Rpb24gZm9ybWF0UkdCQShjb2xvcjogQ29sb3IpOiBzdHJpbmcge1xuXHRcdFx0XHRyZXR1cm4gYHJnYmEoJHtjb2xvci5yZ2JhLnJ9LCAke2NvbG9yLnJnYmEuZ30sICR7Y29sb3IucmdiYS5ifSwgJHsrKGNvbG9yLnJnYmEuYSkudG9GaXhlZCgyKX0pYDtcblx0XHRcdH1cblxuXHRcdFx0ZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdEhTTChjb2xvcjogQ29sb3IpOiBzdHJpbmcge1xuXHRcdFx0XHRpZiAoY29sb3IuaHNsYS5hID09PSAxKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGBoc2woJHtjb2xvci5oc2xhLmh9LCAkeyhjb2xvci5oc2xhLnMgKiAxMDApLnRvRml4ZWQoMil9JSwgJHsoY29sb3IuaHNsYS5sICogMTAwKS50b0ZpeGVkKDIpfSUpYDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdEhTTEEoY29sb3IpO1xuXHRcdFx0fVxuXG5cdFx0XHRleHBvcnQgZnVuY3Rpb24gZm9ybWF0SFNMQShjb2xvcjogQ29sb3IpOiBzdHJpbmcge1xuXHRcdFx0XHRyZXR1cm4gYGhzbGEoJHtjb2xvci5oc2xhLmh9LCAkeyhjb2xvci5oc2xhLnMgKiAxMDApLnRvRml4ZWQoMil9JSwgJHsoY29sb3IuaHNsYS5sICogMTAwKS50b0ZpeGVkKDIpfSUsICR7Y29sb3IuaHNsYS5hLnRvRml4ZWQoMil9KWA7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIF90b1R3b0RpZ2l0SGV4KG46IG51bWJlcik6IHN0cmluZyB7XG5cdFx0XHRcdGNvbnN0IHIgPSBuLnRvU3RyaW5nKDE2KTtcblx0XHRcdFx0cmV0dXJuIHIubGVuZ3RoICE9PSAyID8gJzAnICsgciA6IHI7XG5cdFx0XHR9XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogRm9ybWF0cyB0aGUgY29sb3IgYXMgI1JSR0dCQlxuXHRcdFx0ICovXG5cdFx0XHRleHBvcnQgZnVuY3Rpb24gZm9ybWF0SGV4KGNvbG9yOiBDb2xvcik6IHN0cmluZyB7XG5cdFx0XHRcdHJldHVybiBgIyR7X3RvVHdvRGlnaXRIZXgoY29sb3IucmdiYS5yKX0ke190b1R3b0RpZ2l0SGV4KGNvbG9yLnJnYmEuZyl9JHtfdG9Ud29EaWdpdEhleChjb2xvci5yZ2JhLmIpfWA7XG5cdFx0XHR9XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogRm9ybWF0cyB0aGUgY29sb3IgYXMgI1JSR0dCQkFBXG5cdFx0XHQgKiBJZiAnY29tcGFjdCcgaXMgc2V0LCBjb2xvcnMgd2l0aG91dCB0cmFuc3BhcmFuY3kgd2lsbCBiZSBwcmludGVkIGFzICNSUkdHQkJcblx0XHRcdCAqL1xuXHRcdFx0ZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdEhleEEoY29sb3I6IENvbG9yLCBjb21wYWN0ID0gZmFsc2UpOiBzdHJpbmcge1xuXHRcdFx0XHRpZiAoY29tcGFjdCAmJiBjb2xvci5yZ2JhLmEgPT09IDEpIHtcblx0XHRcdFx0XHRyZXR1cm4gQ29sb3IuRm9ybWF0LkNTUy5mb3JtYXRIZXgoY29sb3IpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGAjJHtfdG9Ud29EaWdpdEhleChjb2xvci5yZ2JhLnIpfSR7X3RvVHdvRGlnaXRIZXgoY29sb3IucmdiYS5nKX0ke190b1R3b0RpZ2l0SGV4KGNvbG9yLnJnYmEuYil9JHtfdG9Ud29EaWdpdEhleChNYXRoLnJvdW5kKGNvbG9yLnJnYmEuYSAqIDI1NSkpfWA7XG5cdFx0XHR9XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogVGhlIGRlZmF1bHQgZm9ybWF0IHdpbGwgdXNlIEhFWCBpZiBvcGFxdWUgYW5kIFJHQkEgb3RoZXJ3aXNlLlxuXHRcdFx0ICovXG5cdFx0XHRleHBvcnQgZnVuY3Rpb24gZm9ybWF0KGNvbG9yOiBDb2xvcik6IHN0cmluZyB7XG5cdFx0XHRcdGlmIChjb2xvci5pc09wYXF1ZSgpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4KGNvbG9yKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdFJHQkEoY29sb3IpO1xuXHRcdFx0fVxuXG5cdFx0XHQvKipcblx0XHRcdCAqIFBhcnNlIGEgQ1NTIGNvbG9yIGFuZCByZXR1cm4gYSB7QGxpbmsgQ29sb3J9LlxuXHRcdFx0ICogQHBhcmFtIGNzcyBUaGUgQ1NTIGNvbG9yIHRvIHBhcnNlLlxuXHRcdFx0ICogQHNlZSBodHRwczovL2RyYWZ0cy5jc3N3Zy5vcmcvY3NzLWNvbG9yLyN0eXBlZGVmLWNvbG9yXG5cdFx0XHQgKi9cblx0XHRcdGV4cG9ydCBmdW5jdGlvbiBwYXJzZShjc3M6IHN0cmluZyk6IENvbG9yIHwgbnVsbCB7XG5cdFx0XHRcdGlmIChjc3MgPT09ICd0cmFuc3BhcmVudCcpIHtcblx0XHRcdFx0XHRyZXR1cm4gQ29sb3IudHJhbnNwYXJlbnQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGNzcy5zdGFydHNXaXRoKCcjJykpIHtcblx0XHRcdFx0XHRyZXR1cm4gcGFyc2VIZXgoY3NzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoY3NzLnN0YXJ0c1dpdGgoJ3JnYmEoJykpIHtcblx0XHRcdFx0XHRjb25zdCBjb2xvciA9IGNzcy5tYXRjaCgvcmdiYVxcKCg/PHI+KD86XFwrfC0pP1xcZCspLCAqKD88Zz4oPzpcXCt8LSk/XFxkKyksICooPzxiPig/OlxcK3wtKT9cXGQrKSwgKig/PGE+KD86XFwrfC0pP1xcZCsoXFwuXFxkKyk/KVxcKS8pO1xuXHRcdFx0XHRcdGlmICghY29sb3IpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2xvciBmb3JtYXQgJyArIGNzcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHIgPSBwYXJzZUludChjb2xvci5ncm91cHM/LnIgPz8gJzAnKTtcblx0XHRcdFx0XHRjb25zdCBnID0gcGFyc2VJbnQoY29sb3IuZ3JvdXBzPy5nID8/ICcwJyk7XG5cdFx0XHRcdFx0Y29uc3QgYiA9IHBhcnNlSW50KGNvbG9yLmdyb3Vwcz8uYiA/PyAnMCcpO1xuXHRcdFx0XHRcdGNvbnN0IGEgPSBwYXJzZUZsb2F0KGNvbG9yLmdyb3Vwcz8uYSA/PyAnMCcpO1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEociwgZywgYiwgYSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChjc3Muc3RhcnRzV2l0aCgncmdiKCcpKSB7XG5cdFx0XHRcdFx0Y29uc3QgY29sb3IgPSBjc3MubWF0Y2goL3JnYlxcKCg/PHI+KD86XFwrfC0pP1xcZCspLCAqKD88Zz4oPzpcXCt8LSk/XFxkKyksICooPzxiPig/OlxcK3wtKT9cXGQrKVxcKS8pO1xuXHRcdFx0XHRcdGlmICghY29sb3IpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2xvciBmb3JtYXQgJyArIGNzcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHIgPSBwYXJzZUludChjb2xvci5ncm91cHM/LnIgPz8gJzAnKTtcblx0XHRcdFx0XHRjb25zdCBnID0gcGFyc2VJbnQoY29sb3IuZ3JvdXBzPy5nID8/ICcwJyk7XG5cdFx0XHRcdFx0Y29uc3QgYiA9IHBhcnNlSW50KGNvbG9yLmdyb3Vwcz8uYiA/PyAnMCcpO1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEociwgZywgYikpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIFRPRE86IFN1cHBvcnQgbW9yZSBmb3JtYXRzIGFzIG5lZWRlZFxuXHRcdFx0XHRyZXR1cm4gcGFyc2VOYW1lZEtleXdvcmQoY3NzKTtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gcGFyc2VOYW1lZEtleXdvcmQoY3NzOiBzdHJpbmcpOiBDb2xvciB8IG51bGwge1xuXHRcdFx0XHQvLyBodHRwczovL2RyYWZ0cy5jc3N3Zy5vcmcvY3NzLWNvbG9yLyNuYW1lZC1jb2xvcnNcblx0XHRcdFx0c3dpdGNoIChjc3MpIHtcblx0XHRcdFx0XHRjYXNlICdhbGljZWJsdWUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI0MCwgMjQ4LCAyNTUsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdhbnRpcXVld2hpdGUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1MCwgMjM1LCAyMTUsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdhcXVhJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgwLCAyNTUsIDI1NSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2FxdWFtYXJpbmUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDEyNywgMjU1LCAyMTIsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdhenVyZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjQwLCAyNTUsIDI1NSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2JlaWdlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNDUsIDI0NSwgMjIwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnYmlzcXVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDIyOCwgMTk2LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnYmxhY2snOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDAsIDAsIDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdibGFuY2hlZGFsbW9uZCc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAyMzUsIDIwNSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2JsdWUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDAsIDAsIDI1NSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2JsdWV2aW9sZXQnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDEzOCwgNDMsIDIyNiwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2Jyb3duJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxNjUsIDQyLCA0MiwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2J1cmx5d29vZCc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjIyLCAxODQsIDEzNSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2NhZGV0Ymx1ZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoOTUsIDE1OCwgMTYwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnY2hhcnRyZXVzZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTI3LCAyNTUsIDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdjaG9jb2xhdGUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDIxMCwgMTA1LCAzMCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2NvcmFsJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDEyNywgODAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdjb3JuZmxvd2VyYmx1ZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTAwLCAxNDksIDIzNywgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2Nvcm5zaWxrJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDI0OCwgMjIwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnY3JpbXNvbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjIwLCAyMCwgNjAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdjeWFuJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgwLCAyNTUsIDI1NSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2RhcmtibHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgwLCAwLCAxMzksIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrY3lhbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMCwgMTM5LCAxMzksIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrZ29sZGVucm9kJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxODQsIDEzNCwgMTEsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrZ3JheSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTY5LCAxNjksIDE2OSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2RhcmtncmVlbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMCwgMTAwLCAwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnZGFya2dyZXknOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDE2OSwgMTY5LCAxNjksIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJra2hha2knOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDE4OSwgMTgzLCAxMDcsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrbWFnZW50YSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTM5LCAwLCAxMzksIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrb2xpdmVncmVlbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoODUsIDEwNywgNDcsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrb3JhbmdlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDE0MCwgMCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2RhcmtvcmNoaWQnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDE1MywgNTAsIDIwNCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2RhcmtyZWQnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDEzOSwgMCwgMCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2RhcmtzYWxtb24nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDIzMywgMTUwLCAxMjIsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrc2VhZ3JlZW4nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDE0MywgMTg4LCAxNDMsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrc2xhdGVibHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSg3MiwgNjEsIDEzOSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2RhcmtzbGF0ZWdyYXknOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDQ3LCA3OSwgNzksIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrc2xhdGVncmV5JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSg0NywgNzksIDc5LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnZGFya3R1cnF1b2lzZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMCwgMjA2LCAyMDksIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkYXJrdmlvbGV0JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxNDgsIDAsIDIxMSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2RlZXBwaW5rJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDIwLCAxNDcsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkZWVwc2t5Ymx1ZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMCwgMTkxLCAyNTUsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdkaW1ncmF5JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxMDUsIDEwNSwgMTA1LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnZGltZ3JleSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTA1LCAxMDUsIDEwNSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2RvZGdlcmJsdWUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDMwLCAxNDQsIDI1NSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2ZpcmVicmljayc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTc4LCAzNCwgMzQsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdmbG9yYWx3aGl0ZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAyNTAsIDI0MCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2ZvcmVzdGdyZWVuJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgzNCwgMTM5LCAzNCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2Z1Y2hzaWEnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgMCwgMjU1LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnZ2FpbnNib3JvJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyMjAsIDIyMCwgMjIwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnZ2hvc3R3aGl0ZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjQ4LCAyNDgsIDI1NSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2dvbGQnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgMjE1LCAwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnZ29sZGVucm9kJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyMTgsIDE2NSwgMzIsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdncmF5JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxMjgsIDEyOCwgMTI4LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnZ3JlZW4nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDAsIDEyOCwgMCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2dyZWVueWVsbG93JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxNzMsIDI1NSwgNDcsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdncmV5JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxMjgsIDEyOCwgMTI4LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnaG9uZXlkZXcnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI0MCwgMjU1LCAyNDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdob3RwaW5rJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDEwNSwgMTgwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnaW5kaWFucmVkJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyMDUsIDkyLCA5MiwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2luZGlnbyc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoNzUsIDAsIDEzMCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2l2b3J5JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDI1NSwgMjQwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAna2hha2knOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI0MCwgMjMwLCAxNDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdsYXZlbmRlcic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjMwLCAyMzAsIDI1MCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2xhdmVuZGVyYmx1c2gnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgMjQwLCAyNDUsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdsYXduZ3JlZW4nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDEyNCwgMjUyLCAwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGVtb25jaGlmZm9uJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDI1MCwgMjA1LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGlnaHRibHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxNzMsIDIxNiwgMjMwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGlnaHRjb3JhbCc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjQwLCAxMjgsIDEyOCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2xpZ2h0Y3lhbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjI0LCAyNTUsIDI1NSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2xpZ2h0Z29sZGVucm9keWVsbG93JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTAsIDI1MCwgMjEwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGlnaHRncmF5JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyMTEsIDIxMSwgMjExLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGlnaHRncmVlbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTQ0LCAyMzgsIDE0NCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2xpZ2h0Z3JleSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjExLCAyMTEsIDIxMSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2xpZ2h0cGluayc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAxODIsIDE5MywgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2xpZ2h0c2FsbW9uJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDE2MCwgMTIyLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGlnaHRzZWFncmVlbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMzIsIDE3OCwgMTcwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGlnaHRza3libHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxMzUsIDIwNiwgMjUwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGlnaHRzbGF0ZWdyYXknOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDExOSwgMTM2LCAxNTMsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdsaWdodHNsYXRlZ3JleSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTE5LCAxMzYsIDE1MywgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ2xpZ2h0c3RlZWxibHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxNzYsIDE5NiwgMjIyLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGlnaHR5ZWxsb3cnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgMjU1LCAyMjQsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdsaW1lJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgwLCAyNTUsIDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdsaW1lZ3JlZW4nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDUwLCAyMDUsIDUwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbGluZW4nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1MCwgMjQwLCAyMzAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdtYWdlbnRhJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDAsIDI1NSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ21hcm9vbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTI4LCAwLCAwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbWVkaXVtYXF1YW1hcmluZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTAyLCAyMDUsIDE3MCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ21lZGl1bWJsdWUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDAsIDAsIDIwNSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ21lZGl1bW9yY2hpZCc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTg2LCA4NSwgMjExLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbWVkaXVtcHVycGxlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxNDcsIDExMiwgMjE5LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbWVkaXVtc2VhZ3JlZW4nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDYwLCAxNzksIDExMywgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ21lZGl1bXNsYXRlYmx1ZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTIzLCAxMDQsIDIzOCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ21lZGl1bXNwcmluZ2dyZWVuJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgwLCAyNTAsIDE1NCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ21lZGl1bXR1cnF1b2lzZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoNzIsIDIwOSwgMjA0LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbWVkaXVtdmlvbGV0cmVkJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxOTksIDIxLCAxMzMsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdtaWRuaWdodGJsdWUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1LCAyNSwgMTEyLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbWludGNyZWFtJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNDUsIDI1NSwgMjUwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbWlzdHlyb3NlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDIyOCwgMjI1LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnbW9jY2FzaW4nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgMjI4LCAxODEsIDEpKTtcblx0XHRcdFx0XHRjYXNlICduYXZham93aGl0ZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAyMjIsIDE3MywgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ25hdnknOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDAsIDAsIDEyOCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ29sZGxhY2UnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1MywgMjQ1LCAyMzAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdvbGl2ZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTI4LCAxMjgsIDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdvbGl2ZWRyYWInOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDEwNywgMTQyLCAzNSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ29yYW5nZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAxNjUsIDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdvcmFuZ2VyZWQnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgNjksIDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdvcmNoaWQnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDIxOCwgMTEyLCAyMTQsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdwYWxlZ29sZGVucm9kJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyMzgsIDIzMiwgMTcwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAncGFsZWdyZWVuJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxNTIsIDI1MSwgMTUyLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAncGFsZXR1cnF1b2lzZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTc1LCAyMzgsIDIzOCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ3BhbGV2aW9sZXRyZWQnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDIxOSwgMTEyLCAxNDcsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdwYXBheWF3aGlwJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDIzOSwgMjEzLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAncGVhY2hwdWZmJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDIxOCwgMTg1LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAncGVydSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjA1LCAxMzMsIDYzLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAncGluayc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAxOTIsIDIwMywgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ3BsdW0nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDIyMSwgMTYwLCAyMjEsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdwb3dkZXJibHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxNzYsIDIyNCwgMjMwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAncHVycGxlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxMjgsIDAsIDEyOCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ3JlYmVjY2FwdXJwbGUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDEwMiwgNTEsIDE1MywgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ3JlZCc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAwLCAwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAncm9zeWJyb3duJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxODgsIDE0MywgMTQzLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAncm95YWxibHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSg2NSwgMTA1LCAyMjUsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdzYWRkbGVicm93bic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTM5LCA2OSwgMTksIDEpKTtcblx0XHRcdFx0XHRjYXNlICdzYWxtb24nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1MCwgMTI4LCAxMTQsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdzYW5keWJyb3duJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNDQsIDE2NCwgOTYsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdzZWFncmVlbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoNDYsIDEzOSwgODcsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdzZWFzaGVsbCc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAyNDUsIDIzOCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ3NpZW5uYSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTYwLCA4MiwgNDUsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdzaWx2ZXInOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDE5MiwgMTkyLCAxOTIsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdza3libHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxMzUsIDIwNiwgMjM1LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnc2xhdGVibHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgxMDYsIDkwLCAyMDUsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdzbGF0ZWdyYXknOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDExMiwgMTI4LCAxNDQsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdzbGF0ZWdyZXknOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDExMiwgMTI4LCAxNDQsIDEpKTtcblx0XHRcdFx0XHRjYXNlICdzbm93JzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDI1MCwgMjUwLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnc3ByaW5nZ3JlZW4nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDAsIDI1NSwgMTI3LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnc3RlZWxibHVlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSg3MCwgMTMwLCAxODAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICd0YW4nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDIxMCwgMTgwLCAxNDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICd0ZWFsJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgwLCAxMjgsIDEyOCwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ3RoaXN0bGUnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDIxNiwgMTkxLCAyMTYsIDEpKTtcblx0XHRcdFx0XHRjYXNlICd0b21hdG8nOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgOTksIDcxLCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAndHVycXVvaXNlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSg2NCwgMjI0LCAyMDgsIDEpKTtcblx0XHRcdFx0XHRjYXNlICd2aW9sZXQnOiByZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDIzOCwgMTMwLCAyMzgsIDEpKTtcblx0XHRcdFx0XHRjYXNlICd3aGVhdCc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjQ1LCAyMjIsIDE3OSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ3doaXRlJzogcmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDI1NSwgMjU1LCAxKSk7XG5cdFx0XHRcdFx0Y2FzZSAnd2hpdGVzbW9rZSc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjQ1LCAyNDUsIDI0NSwgMSkpO1xuXHRcdFx0XHRcdGNhc2UgJ3llbGxvdyc6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMjU1LCAyNTUsIDAsIDEpKTtcblx0XHRcdFx0XHRjYXNlICd5ZWxsb3dncmVlbic6IHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTU0LCAyMDUsIDUwLCAxKSk7XG5cdFx0XHRcdFx0ZGVmYXVsdDogcmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBDb252ZXJ0cyBhbiBIZXggY29sb3IgdmFsdWUgdG8gYSBDb2xvci5cblx0XHRcdCAqIHJldHVybnMgciwgZywgYW5kIGIgYXJlIGNvbnRhaW5lZCBpbiB0aGUgc2V0IFswLCAyNTVdXG5cdFx0XHQgKiBAcGFyYW0gaGV4IHN0cmluZyAoI1JHQiwgI1JHQkEsICNSUkdHQkIgb3IgI1JSR0dCQkFBKS5cblx0XHRcdCAqL1xuXHRcdFx0ZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSGV4KGhleDogc3RyaW5nKTogQ29sb3IgfCBudWxsIHtcblx0XHRcdFx0Y29uc3QgbGVuZ3RoID0gaGV4Lmxlbmd0aDtcblxuXHRcdFx0XHRpZiAobGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Ly8gSW52YWxpZCBjb2xvclxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGhleC5jaGFyQ29kZUF0KDApICE9PSBDaGFyQ29kZS5IYXNoKSB7XG5cdFx0XHRcdFx0Ly8gRG9lcyBub3QgYmVnaW4gd2l0aCBhICNcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChsZW5ndGggPT09IDcpIHtcblx0XHRcdFx0XHQvLyAjUlJHR0JCIGZvcm1hdFxuXHRcdFx0XHRcdGNvbnN0IHIgPSAxNiAqIF9wYXJzZUhleERpZ2l0KGhleC5jaGFyQ29kZUF0KDEpKSArIF9wYXJzZUhleERpZ2l0KGhleC5jaGFyQ29kZUF0KDIpKTtcblx0XHRcdFx0XHRjb25zdCBnID0gMTYgKiBfcGFyc2VIZXhEaWdpdChoZXguY2hhckNvZGVBdCgzKSkgKyBfcGFyc2VIZXhEaWdpdChoZXguY2hhckNvZGVBdCg0KSk7XG5cdFx0XHRcdFx0Y29uc3QgYiA9IDE2ICogX3BhcnNlSGV4RGlnaXQoaGV4LmNoYXJDb2RlQXQoNSkpICsgX3BhcnNlSGV4RGlnaXQoaGV4LmNoYXJDb2RlQXQoNikpO1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEociwgZywgYiwgMSkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGxlbmd0aCA9PT0gOSkge1xuXHRcdFx0XHRcdC8vICNSUkdHQkJBQSBmb3JtYXRcblx0XHRcdFx0XHRjb25zdCByID0gMTYgKiBfcGFyc2VIZXhEaWdpdChoZXguY2hhckNvZGVBdCgxKSkgKyBfcGFyc2VIZXhEaWdpdChoZXguY2hhckNvZGVBdCgyKSk7XG5cdFx0XHRcdFx0Y29uc3QgZyA9IDE2ICogX3BhcnNlSGV4RGlnaXQoaGV4LmNoYXJDb2RlQXQoMykpICsgX3BhcnNlSGV4RGlnaXQoaGV4LmNoYXJDb2RlQXQoNCkpO1xuXHRcdFx0XHRcdGNvbnN0IGIgPSAxNiAqIF9wYXJzZUhleERpZ2l0KGhleC5jaGFyQ29kZUF0KDUpKSArIF9wYXJzZUhleERpZ2l0KGhleC5jaGFyQ29kZUF0KDYpKTtcblx0XHRcdFx0XHRjb25zdCBhID0gMTYgKiBfcGFyc2VIZXhEaWdpdChoZXguY2hhckNvZGVBdCg3KSkgKyBfcGFyc2VIZXhEaWdpdChoZXguY2hhckNvZGVBdCg4KSk7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBDb2xvcihuZXcgUkdCQShyLCBnLCBiLCBhIC8gMjU1KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobGVuZ3RoID09PSA0KSB7XG5cdFx0XHRcdFx0Ly8gI1JHQiBmb3JtYXRcblx0XHRcdFx0XHRjb25zdCByID0gX3BhcnNlSGV4RGlnaXQoaGV4LmNoYXJDb2RlQXQoMSkpO1xuXHRcdFx0XHRcdGNvbnN0IGcgPSBfcGFyc2VIZXhEaWdpdChoZXguY2hhckNvZGVBdCgyKSk7XG5cdFx0XHRcdFx0Y29uc3QgYiA9IF9wYXJzZUhleERpZ2l0KGhleC5jaGFyQ29kZUF0KDMpKTtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IENvbG9yKG5ldyBSR0JBKDE2ICogciArIHIsIDE2ICogZyArIGcsIDE2ICogYiArIGIpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChsZW5ndGggPT09IDUpIHtcblx0XHRcdFx0XHQvLyAjUkdCQSBmb3JtYXRcblx0XHRcdFx0XHRjb25zdCByID0gX3BhcnNlSGV4RGlnaXQoaGV4LmNoYXJDb2RlQXQoMSkpO1xuXHRcdFx0XHRcdGNvbnN0IGcgPSBfcGFyc2VIZXhEaWdpdChoZXguY2hhckNvZGVBdCgyKSk7XG5cdFx0XHRcdFx0Y29uc3QgYiA9IF9wYXJzZUhleERpZ2l0KGhleC5jaGFyQ29kZUF0KDMpKTtcblx0XHRcdFx0XHRjb25zdCBhID0gX3BhcnNlSGV4RGlnaXQoaGV4LmNoYXJDb2RlQXQoNCkpO1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQ29sb3IobmV3IFJHQkEoMTYgKiByICsgciwgMTYgKiBnICsgZywgMTYgKiBiICsgYiwgKDE2ICogYSArIGEpIC8gMjU1KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJbnZhbGlkIGNvbG9yXG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBfcGFyc2VIZXhEaWdpdChjaGFyQ29kZTogQ2hhckNvZGUpOiBudW1iZXIge1xuXHRcdFx0XHRzd2l0Y2ggKGNoYXJDb2RlKSB7XG5cdFx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5EaWdpdDA6IHJldHVybiAwO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuRGlnaXQxOiByZXR1cm4gMTtcblx0XHRcdFx0XHRjYXNlIENoYXJDb2RlLkRpZ2l0MjogcmV0dXJuIDI7XG5cdFx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5EaWdpdDM6IHJldHVybiAzO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuRGlnaXQ0OiByZXR1cm4gNDtcblx0XHRcdFx0XHRjYXNlIENoYXJDb2RlLkRpZ2l0NTogcmV0dXJuIDU7XG5cdFx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5EaWdpdDY6IHJldHVybiA2O1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuRGlnaXQ3OiByZXR1cm4gNztcblx0XHRcdFx0XHRjYXNlIENoYXJDb2RlLkRpZ2l0ODogcmV0dXJuIDg7XG5cdFx0XHRcdFx0Y2FzZSBDaGFyQ29kZS5EaWdpdDk6IHJldHVybiA5O1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuYTogcmV0dXJuIDEwO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuQTogcmV0dXJuIDEwO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuYjogcmV0dXJuIDExO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuQjogcmV0dXJuIDExO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuYzogcmV0dXJuIDEyO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuQzogcmV0dXJuIDEyO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuZDogcmV0dXJuIDEzO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuRDogcmV0dXJuIDEzO1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuZTogcmV0dXJuIDE0O1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuRTogcmV0dXJuIDE0O1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuZjogcmV0dXJuIDE1O1xuXHRcdFx0XHRcdGNhc2UgQ2hhckNvZGUuRjogcmV0dXJuIDE1O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxXQUFXLFFBQWdCLGVBQStCO0FBQ2xFLFFBQU0sVUFB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SyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxVQUM3RCxLQUFLO0FBQWEsbUJBQU8sSUFBSUEsT0FBTSxJQUFJLEtBQUssSUFBSSxLQUFLLEtBQUssQ0FBQyxDQUFDO0FBQUEsVUFDNUQsS0FBSztBQUFlLG1CQUFPLElBQUlBLE9BQU0sSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQztBQUFBLFVBQzdELEtBQUs7QUFBVSxtQkFBTyxJQUFJQSxPQUFNLElBQUksS0FBSyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxVQUMxRCxLQUFLO0FBQWMsbUJBQU8sSUFBSUEsT0FBTSxJQUFJLEtBQUssS0FBSyxLQUFLLElBQUksQ0FBQyxDQUFDO0FBQUEsVUFDN0QsS0FBSztBQUFZLG1CQUFPLElBQUlBLE9BQU0sSUFBSSxLQUFLLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQztBQUFBLFVBQzFELEtBQUs7QUFBWSxtQkFBTyxJQUFJQSxPQUFNLElBQUksS0FBSyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxVQUM1RCxLQUFLO0FBQVUsbUJBQU8sSUFBSUEsT0FBTSxJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDO0FBQUEsVUFDeEQsS0FBSztBQUFVLG1CQUFPLElBQUlBLE9BQU0sSUFBSSxLQUFLLEtBQUssS0FBSyxLQUFLLENBQUMsQ0FBQztBQUFBLFVBQzFELEtBQUs7QUFBVyxtQkFBTyxJQUFJQSxPQUFNLElBQUksS0FBSyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxVQUMzRCxLQUFLO0FBQWEsbUJBQU8sSUFBSUEsT0FBTSxJQUFJLEtBQUssS0FBSyxJQUFJLEtBQUssQ0FBQyxDQUFDO0FBQUEsVUFDNUQsS0FBSztBQUFhLG1CQUFPLElBQUlBLE9BQU0sSUFBSSxLQUFLLEtBQUssS0FBSyxLQUFLLENBQUMsQ0FBQztBQUFBLFVBQzdELEtBQUs7QUFBYSxtQkFBTyxJQUFJQSxPQUFNLElBQUksS0FBSyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxVQUM3RCxLQUFLO0FBQVEsbUJBQU8sSUFBSUEsT0FBTSxJQUFJLEtBQUssS0FBSyxLQUFLLEtBQUssQ0FBQyxDQUFDO0FBQUEsVUFDeEQsS0FBSztBQUFlLG1CQUFPLElBQUlBLE9BQU0sSUFBSSxLQUFLLEdBQUcsS0FBSyxLQUFLLENBQUMsQ0FBQztBQUFBLFVBQzdELEtBQUs7QUFBYSxtQkFBTyxJQUFJQSxPQUFNLElBQUksS0FBSyxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxVQUM1RCxLQUFLO0FBQU8sbUJBQU8sSUFBSUEsT0FBTSxJQUFJLEtBQUssS0FBSyxLQUFLLEtBQUssQ0FBQyxDQUFDO0FBQUEsVUFDdkQsS0FBSztBQUFRLG1CQUFPLElBQUlBLE9BQU0sSUFBSSxLQUFLLEdBQUcsS0FBSyxLQUFLLENBQUMsQ0FBQztBQUFBLFVBQ3RELEtBQUs7QUFBVyxtQkFBTyxJQUFJQSxPQUFNLElBQUksS0FBSyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxVQUMzRCxLQUFLO0FBQVUsbUJBQU8sSUFBSUEsT0FBTSxJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDO0FBQUEsVUFDeEQsS0FBSztBQUFhLG1CQUFPLElBQUlBLE9BQU0sSUFBSSxLQUFLLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQztBQUFBLFVBQzVELEtBQUs7QUFBVSxtQkFBTyxJQUFJQSxPQUFNLElBQUksS0FBSyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxVQUMxRCxLQUFLO0FBQVMsbUJBQU8sSUFBSUEsT0FBTSxJQUFJLEtBQUssS0FBSyxLQUFLLEtBQUssQ0FBQyxDQUFDO0FBQUEsVUFDekQsS0FBSztBQUFTLG1CQUFPLElBQUlBLE9BQU0sSUFBSSxLQUFLLEtBQUssS0FBSyxLQUFLLENBQUMsQ0FBQztBQUFBLFVBQ3pELEtBQUs7QUFBYyxtQkFBTyxJQUFJQSxPQUFNLElBQUksS0FBSyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxVQUM5RCxLQUFLO0FBQVUs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U0FBUztBQUFRLG1CQUFPO0FBQUEsVUFDN0IsS0FBSyxTQUFTO0FBQVEsbUJBQU87QUFBQSxVQUM3QixLQUFLLFNBQVM7QUFBUSxtQkFBTztBQUFBLFVBQzdCLEtBQUssU0FBUztBQUFRLG1CQUFPO0FBQUEsVUFDN0IsS0FBSyxTQUFTO0FBQVEsbUJBQU87QUFBQSxVQUM3QixLQUFLLFNBQVM7QUFBUSxtQkFBTztBQUFBLFVBQzdCLEtBQUssU0FBUztBQUFHLG1CQUFPO0FBQUEsVUFDeEIsS0FBSyxTQUFTO0FBQUcsbUJBQU87QUFBQSxVQUN4QixLQUFLLFNBQVM7QUFBRyxtQkFBTztBQUFBLFVBQ3hCLEtBQUssU0FBUztBQUFHLG1CQUFPO0FBQUEsVUFDeEIsS0FBSyxTQUFTO0FBQUcsbUJBQU87QUFBQSxVQUN4QixLQUFLLFNBQVM7QUFBRyxtQkFBTztBQUFBLFVBQ3hCLEtBQUssU0FBUztBQUFHLG1CQUFPO0FBQUEsVUFDeEIsS0FBSyxTQUFTO0FBQUcsbUJBQU87QUFBQSxVQUN4QixLQUFLLFNBQVM7QUFBRyxtQkFBTztBQUFBLFVBQ3hCLEtBQUssU0FBUztBQUFHLG1CQUFPO0FBQUEsVUFDeEIsS0FBSyxTQUFTO0FBQUcsbUJBQU87QUFBQSxVQUN4QixLQUFLLFNBQVM7QUFBRyxtQkFBTztBQUFBLFFBQ3pCO0FBQ0EsZUFBTztBQUFBLE1BQ1I7QUFBQSxPQS9VZ0IsTUFBQUQsUUFBQSxRQUFBQSxRQUFBO0FBQUEsS0FERCxTQUFBRCxPQUFBLFdBQUFBLE9BQUE7QUFBQSxHQUREOyIsCiAgIm5hbWVzIjogWyJyZXN1bHRBIiwgInJlc3VsdEFSYXRpbyIsICJDb2xvciIsICJGb3JtYXQiLCAiQ1NTIl0KfQo=
