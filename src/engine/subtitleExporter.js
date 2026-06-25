/**
 * CineCutPro — Subtitle Exporter.
 *
 * Exports subtitle track clips as SRT, WebVTT, or ASS format files.
 *
 * Usage:
 *   import { exportSRT, exportVTT, exportASS, downloadSubtitles } from './subtitleExporter.js';
 *   const srt = exportSRT(clips);
 *   downloadSubtitles(srt, 'subtitles.srt', 'text/plain');
 */

/**
 * Format seconds as SRT timecode (HH:MM:SS,mmm).
 */
function formatSRT(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Format seconds as WebVTT timecode (HH:MM:SS.mmm).
 */
function formatVTT(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Format seconds as ASS timecode (H:MM:SS.cc — centiseconds).
 */
function formatASS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Extract subtitle text and timing from clip objects.
 * Filters for subtitle/title clips that have text content.
 */
function extractSubtitles(clips) {
  return clips
    .filter((c) => c.title?.text && (c.kind === 'subtitle' || c.kind === 'title'))
    .sort((a, b) => a.start - b.start)
    .map((c, i) => ({
      index: i + 1,
      start: c.start,
      end: c.end,
      text: c.title.text,
      font: c.title.font,
      size: c.title.size,
      color: c.title.color,
      bold: (c.title.weight ?? 400) >= 700,
      italic: c.title.italic ?? false,
      align: c.title.align ?? 'center'
    }));
}

/**
 * Export subtitles as SRT (SubRip Text) format.
 * @param {object[]} clips — clip objects from state
 * @returns {string} — SRT file content
 */
export function exportSRT(clips) {
  const subs = extractSubtitles(clips);
  return subs
    .map(
      (s) =>
        `${s.index}\n${formatSRT(s.start)} --> ${formatSRT(s.end)}\n${s.text}\n`
    )
    .join('\n');
}

/**
 * Export subtitles as WebVTT format.
 * @param {object[]} clips — clip objects from state
 * @returns {string} — VTT file content
 */
export function exportVTT(clips) {
  const subs = extractSubtitles(clips);
  const cues = subs
    .map(
      (s) =>
        `${s.index}\n${formatVTT(s.start)} --> ${formatVTT(s.end)}\n${s.text}\n`
    )
    .join('\n');
  return `WEBVTT\n\n${cues}`;
}

/**
 * Export subtitles as ASS (Advanced SubStation Alpha) format.
 * Preserves styling information (font, size, color, alignment).
 * @param {object[]} clips — clip objects from state
 * @param {object} options — project settings for resolution
 * @returns {string} — ASS file content
 */
export function exportASS(clips, options = {}) {
  const { width = 1920, height = 1080, title = 'CineCutPro Subtitles' } = options;
  const subs = extractSubtitles(clips);

  // Convert hex color to ASS BGR format (&HBBGGRR)
  const hexToASS = (hex) => {
    if (!hex || hex.length < 7) return '&H00FFFFFF';
    const r = hex.slice(1, 3);
    const g = hex.slice(3, 5);
    const b = hex.slice(5, 7);
    return `&H00${b}${g}${r}`.toUpperCase();
  };

  // Alignment map (SSA uses numpad-style: 1=BL, 2=BC, 5=ML, 8=TL, etc.)
  const alignMap = { left: 1, center: 2, right: 3 };

  const header = `[Script Info]
Title: ${title}
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = subs
    .map((s) => {
      const alignment = alignMap[s.align] ?? 2;
      const bold = s.bold ? 1 : 0;
      let text = s.text;
      // Add inline styling overrides
      const tags = [];
      if (s.font) tags.push(`\\fn${s.font}`);
      if (s.size) tags.push(`\\fs${s.size}`);
      if (s.color) tags.push(`\\c${hexToASS(s.color)}`);
      if (bold) tags.push(`\\b1`);
      if (alignment !== 2) tags.push(`\\an${alignment}`);
      if (tags.length) text = `{${tags.join('')}}${text}`;
      return `Dialogue: 0,${formatASS(s.start)},${formatASS(s.end)},Default,,0,0,0,,${text}`;
    })
    .join('\n');

  return `${header}\n${events}\n`;
}

/**
 * Download subtitle content as a file.
 * @param {string} content — file content
 * @param {string} filename — file name
 * @param {string} mimeType — MIME type
 */
export function downloadSubtitles(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/**
 * Export subtitles in a specified format and trigger download.
 * @param {object[]} clips — clip objects from state
 * @param {string} format — 'srt' | 'vtt' | 'ass'
 * @param {string} baseName — base filename without extension
 * @param {object} options — project settings for ASS format
 */
export function exportAndDownload(clips, format = 'srt', baseName = 'subtitles', options = {}) {
  let content, ext, mime;
  switch (format) {
    case 'vtt':
      content = exportVTT(clips);
      ext = 'vtt';
      mime = 'text/vtt';
      break;
    case 'ass':
      content = exportASS(clips, options);
      ext = 'ass';
      mime = 'text/plain';
      break;
    case 'srt':
    default:
      content = exportSRT(clips);
      ext = 'srt';
      mime = 'text/plain';
      break;
  }
  downloadSubtitles(content, `${baseName}.${ext}`, mime);
}
