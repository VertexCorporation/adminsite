// js/utils/icons.js
//
// Vertex Konsol — merkezi Tabler Icons (SVG) yardımcı modülü.
// Bütün iç arayüz ikonları buradan gelir; web font ya da CDN bağımlılığı yok.
// Kaynak: https://tabler.io/icons (outline seti + filled/award).
// Gerçek katalog adları birebir korunur; dolgu (fill) yalnızca Tabler'ın
// gerçek "filled" sürümü bulunan ikonlarda kullanılır (ör. award).

const PATHS = {
  "crown": "\n  <path d=\"M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4l4 -6\" />\n",
  "users-group": "\n  <path d=\"M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  <path d=\"M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1\" />\n  <path d=\"M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  <path d=\"M17 10h2a2 2 0 0 1 2 2v1\" />\n  <path d=\"M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  <path d=\"M3 13v-1a2 2 0 0 1 2 -2h2\" />\n",
  "bell": "\n  <path d=\"M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6\" />\n  <path d=\"M9 17v1a3 3 0 0 0 6 0v-1\" />\n",
  "robot": "\n  <path d=\"M6 6a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -4\" />\n  <path d=\"M12 2v2\" />\n  <path d=\"M9 12v9\" />\n  <path d=\"M15 12v9\" />\n  <path d=\"M5 16l4 -2\" />\n  <path d=\"M15 14l4 2\" />\n  <path d=\"M9 18h6\" />\n  <path d=\"M10 8v.01\" />\n  <path d=\"M14 8v.01\" />\n",
  "news": "\n  <path d=\"M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11\" />\n  <path d=\"M8 8l4 0\" />\n  <path d=\"M8 12l4 0\" />\n  <path d=\"M8 16l4 0\" />\n",
  "settings": "\n  <path d=\"M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065\" />\n  <path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />\n",
  "messages": "\n  <path d=\"M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10\" />\n  <path d=\"M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2\" />\n",
  "user-circle": "\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" />\n  <path d=\"M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" />\n  <path d=\"M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855\" />\n",
  "pencil": "\n  <path d=\"M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4\" />\n  <path d=\"M13.5 6.5l4 4\" />\n",
  "filter": "\n  <path d=\"M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227\" />\n",
  "shield-lock": "\n  <path d=\"M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3\" />\n  <path d=\"M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  <path d=\"M12 12l0 2.5\" />\n",
  "search": "\n  <path d=\"M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0\" />\n  <path d=\"M21 21l-6 -6\" />\n",
  "award": "\n  <path d=\"M6 9a6 6 0 1 0 12 0a6 6 0 1 0 -12 0\" />\n  <path d=\"M12 15l3.4 5.89l1.598 -3.233l3.598 .232l-3.4 -5.889\" />\n  <path d=\"M6.802 12l-3.4 5.89l3.598 -.233l1.598 3.232l3.4 -5.889\" />\n",
  "dots-vertical": "\n  <path d=\"M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  <path d=\"M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  <path d=\"M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n",
  "refresh": "\n  <path d=\"M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4\" />\n  <path d=\"M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4\" />\n",
  "trash": "\n  <path d=\"M4 7l16 0\" />\n  <path d=\"M10 11l0 6\" />\n  <path d=\"M14 11l0 6\" />\n  <path d=\"M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12\" />\n  <path d=\"M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3\" />\n",
  "external-link": "\n  <path d=\"M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6\" />\n  <path d=\"M11 13l9 -9\" />\n  <path d=\"M15 4h5v5\" />\n",
  "chevron-down": "\n  <path d=\"M6 9l6 6l6 -6\" />\n",
  "x": "\n  <path d=\"M18 6l-12 12\" />\n  <path d=\"M6 6l12 12\" />\n",
  "check": "\n  <path d=\"M5 12l5 5l10 -10\" />\n",
  "calendar-event": "\n  <path d=\"M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12\" />\n  <path d=\"M16 3l0 4\" />\n  <path d=\"M8 3l0 4\" />\n  <path d=\"M4 11l16 0\" />\n  <path d=\"M8 15h2v2h-2l0 -2\" />\n",
  "calendar": "\n  <path d=\"M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12\" />\n  <path d=\"M16 3v4\" />\n  <path d=\"M8 3v4\" />\n  <path d=\"M4 11h16\" />\n  <path d=\"M11 15h1\" />\n  <path d=\"M12 15v3\" />\n",
  "chevron-left": "\n  <path d=\"M15 6l-6 6l6 6\" />\n",
  "chevron-right": "\n  <path d=\"M9 6l6 6l-6 6\" />\n",
  "logout": "\n  <path d=\"M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2\" />\n  <path d=\"M9 12h12l-3 -3\" />\n  <path d=\"M18 15l3 -3\" />\n",
  "plus": "\n  <path d=\"M12 5l0 14\" />\n  <path d=\"M5 12l14 0\" />\n",
  "mail": "\n  <path d=\"M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10\" />\n  <path d=\"M3 7l9 6l9 -6\" />\n",
  "send": "\n  <path d=\"M10 14l11 -11\" />\n  <path d=\"M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5\" />\n",
  "copy": "\n  <path d=\"M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666\" />\n  <path d=\"M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1\" />\n",
  "device-floppy": "\n  <path d=\"M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2\" />\n  <path d=\"M10 14a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  <path d=\"M14 4l0 4l-6 0l0 -4\" />\n",
  "phone": "\n  <path d=\"M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2\" />\n",
  "circle-plus": "\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  <path d=\"M9 12h6\" />\n  <path d=\"M12 9v6\" />\n",
  "menu-2": "\n  <path d=\"M4 6l16 0\" />\n  <path d=\"M4 12l16 0\" />\n  <path d=\"M4 18l16 0\" />\n",
  "moon": "\n  <path d=\"M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008\" />\n",
  "diamond": "\n  <path d=\"M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5\" />\n  <path d=\"M10 12l-2 -2.2l.6 -1\" />\n",
  "sun": "\n  <path d=\"M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" />\n  <path d=\"M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7\" />\n",
  "device-desktop": "\n  <path d=\"M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10\" />\n  <path d=\"M7 20h10\" />\n  <path d=\"M9 16v4\" />\n  <path d=\"M15 16v4\" />\n",
  "language": "\n  <path d=\"M9 6.371c0 4.418 -2.239 6.629 -5 6.629\" />\n  <path d=\"M4 6.371h7\" />\n  <path d=\"M5 9c0 2.144 2.252 3.908 6 4\" />\n  <path d=\"M12 20l4 -9l4 9\" />\n  <path d=\"M19.1 18h-6.2\" />\n  <path d=\"M6.694 3l.793 .582\" />\n",
  "alert-triangle": "\n  <path d=\"M12 9v4\" />\n  <path d=\"M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0\" />\n  <path d=\"M12 16h.01\" />\n",
  "brand-linkedin": "\n  <path d=\"M8 11v5\" />\n  <path d=\"M8 8v.01\" />\n  <path d=\"M12 16v-5\" />\n  <path d=\"M16 16v-3a2 2 0 1 0 -4 0\" />\n  <path d=\"M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4l0 -10\" />\n",
  "circle-check": "\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" />\n  <path d=\"M9 12l2 2l4 -4\" />\n",
  "circle-x": "\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" />\n  <path d=\"M10 10l4 4m0 -4l-4 4\" />\n",
  "shield-check": "\n  <path d=\"M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06\" />\n  <path d=\"M15 19l2 2l4 -4\" />\n",
  "info-circle": "\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  <path d=\"M12 9h.01\" />\n  <path d=\"M11 12h1v4h1\" />\n",
  "loader-2": "\n  <path d=\"M12 3a9 9 0 1 0 9 9\" />\n",
  "exclamation-circle": "\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" />\n  <path d=\"M12 9v4\" />\n  <path d=\"M12 16v.01\" />\n",
  "clock": "\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  <path d=\"M12 7v5l3 3\" />\n",
  "shield-x": "\n  <path d=\"M13.252 20.601c-.408 .155 -.826 .288 -1.252 .399a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.19 7.357\" />\n  <path d=\"M22 22l-5 -5\" />\n  <path d=\"M17 22l5 -5\" />\n",
  "users": "\n  <path d=\"M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" />\n  <path d=\"M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2\" />\n  <path d=\"M16 3.13a4 4 0 0 1 0 7.75\" />\n  <path d=\"M21 21v-2a4 4 0 0 0 -3 -3.85\" />\n",
  "tool": "\n  <path d=\"M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5\" />\n",
  "shield": "\n  <path d=\"M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3\" />\n",
  "user-minus": "\n  <path d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\n  <path d=\"M6 21v-2a4 4 0 0 1 4 -4h4c.348 0 .686 .045 1.009 .128\" />\n  <path d=\"M16 19h6\" />\n",
  "history": "\n  <path d=\"M12 8l0 4l2 2\" />\n  <path d=\"M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5\" />\n",
  "download": "\n  <path d=\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2\" />\n  <path d=\"M7 11l5 5l5 -5\" />\n  <path d=\"M12 4l0 12\" />\n",
  "server": "\n  <path d=\"M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2\" />\n  <path d=\"M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2\" />\n  <path d=\"M7 8l0 .01\" />\n  <path d=\"M7 16l0 .01\" />\n",
  "user-check": "\n  <path d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\n  <path d=\"M6 21v-2a4 4 0 0 1 4 -4h4\" />\n  <path d=\"M15 19l2 2l4 -4\" />\n",
  "list": "\n  <path d=\"M9 6l11 0\" />\n  <path d=\"M9 12l11 0\" />\n  <path d=\"M9 18l11 0\" />\n  <path d=\"M5 6l0 .01\" />\n  <path d=\"M5 12l0 .01\" />\n  <path d=\"M5 18l0 .01\" />\n",
  "repeat": "\n  <path d=\"M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3\" />\n  <path d=\"M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3\" />\n",
  "switch-vertical": "\n  <path d=\"M3 8l4 -4l4 4\" />\n  <path d=\"M7 4l0 9\" />\n  <path d=\"M13 16l4 4l4 -4\" />\n  <path d=\"M17 10l0 10\" />\n",
  "lock": "\n  <path d=\"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6\" />\n  <path d=\"M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0\" />\n  <path d=\"M8 11v-4a4 4 0 1 1 8 0v4\" />\n",
  "article": "\n  <path d=\"M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -12\" />\n  <path d=\"M7 8h10\" />\n  <path d=\"M7 12h10\" />\n  <path d=\"M7 16h10\" />\n",
  "tag": "\n  <path d=\"M6.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  <path d=\"M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3\" />\n",
  "database": "\n  <path d=\"M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0\" />\n  <path d=\"M4 6v6a8 3 0 0 0 16 0v-6\" />\n  <path d=\"M4 12v6a8 3 0 0 0 16 0v-6\" />\n",
  "pin": "\n  <path d=\"M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4\" />\n  <path d=\"M9 15l-4.5 4.5\" />\n  <path d=\"M14.5 4l5.5 5.5\" />\n",
  "badge": "\n  <path d=\"M17 17v-13l-5 3l-5 -3v13l5 3l5 -3\" />\n",
  "adjustments": "\n  <path d=\"M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  <path d=\"M6 4v4\" />\n  <path d=\"M6 12v8\" />\n  <path d=\"M10 16a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  <path d=\"M12 4v10\" />\n  <path d=\"M12 18v2\" />\n  <path d=\"M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  <path d=\"M18 4v1\" />\n  <path d=\"M18 9v11\" />\n",
  "brand-github": "\n  <path d=\"M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5\" />\n",
  "eye": "\n  <path d=\"M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  <path d=\"M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6\" />\n",
  "id": "\n  <path d=\"M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -10\" />\n  <path d=\"M7 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  <path d=\"M15 8l2 0\" />\n  <path d=\"M15 12l2 0\" />\n  <path d=\"M7 16l10 0\" />\n",
  "building-community": "\n  <path d=\"M8 9l5 5v7h-5v-4m0 4h-5v-7l5 -5m1 1v-6a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v17h-8\" />\n  <path d=\"M13 7l0 .01\" />\n  <path d=\"M17 7l0 .01\" />\n  <path d=\"M17 11l0 .01\" />\n  <path d=\"M17 15l0 .01\" />\n",
  "circle-off": "\n  <path d=\"M20.042 16.045a9 9 0 0 0 -12.087 -12.087m-2.318 1.677a9 9 0 1 0 12.725 12.73\" />\n  <path d=\"M3 3l18 18\" />\n",
  "hash": "\n  <path d=\"M5 9l14 0\" />\n  <path d=\"M5 15l14 0\" />\n  <path d=\"M11 4l-4 16\" />\n  <path d=\"M17 4l-4 16\" />\n",
  "chevron-up": "\n  <path d=\"M6 15l6 -6l6 6\" />\n",
  "eye-off": "\n  <path d=\"M10.585 10.587a2 2 0 0 0 2.829 2.828\" />\n  <path d=\"M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87\" />\n  <path d=\"M3 3l18 18\" />\n",
  "alert-circle": "\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  <path d=\"M12 8v4\" />\n  <path d=\"M12 16h.01\" />\n",
  "dots": "\n  <path d=\"M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  <path d=\"M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  <path d=\"M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n",
  "user-plus": "\n  <path d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\n  <path d=\"M16 19h6\" />\n  <path d=\"M19 16v6\" />\n  <path d=\"M6 21v-2a4 4 0 0 1 4 -4h4\" />\n",
  "arrow-right": "\n  <path d=\"M5 12l14 0\" />\n  <path d=\"M13 18l6 -6\" />\n  <path d=\"M13 6l6 6\" />\n",
  "at": "\n  <path d=\"M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" />\n  <path d=\"M16 12v1.5a2.5 2.5 0 0 0 5 0v-1.5a9 9 0 1 0 -5.5 8.28\" />\n",
  "help-circle": "\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  <path d=\"M12 16v.01\" />\n  <path d=\"M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483\" />\n"
};
PATHS.home = '<path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-7h6v7" />';
const FILLED_PATHS = {"award":"\n  <path d=\"M19.496 13.983l1.966 3.406a1.001 1.001 0 0 1 -.705 1.488l-.113 .011l-.112 -.001l-2.933 -.19l-1.303 2.636a1.001 1.001 0 0 1 -1.608 .26l-.082 -.094l-.072 -.11l-1.968 -3.407a8.994 8.994 0 0 0 6.93 -3.999z\" />\n  <path d=\"M11.43 17.982l-1.966 3.408a1.001 1.001 0 0 1 -1.622 .157l-.076 -.1l-.064 -.114l-1.304 -2.635l-2.931 .19a1.001 1.001 0 0 1 -1.022 -1.29l.04 -.107l.05 -.1l1.968 -3.409a8.994 8.994 0 0 0 6.927 4.001z\" />\n  <path d=\"M12 2l.24 .004a7 7 0 0 1 6.76 6.996l-.003 .193l-.007 .192l-.018 .245l-.026 .242l-.024 .178a6.985 6.985 0 0 1 -.317 1.268l-.116 .308l-.153 .348a7.001 7.001 0 0 1 -12.688 -.028l-.13 -.297l-.052 -.133l-.08 -.217l-.095 -.294a6.96 6.96 0 0 1 -.093 -.344l-.06 -.271l-.049 -.271l-.02 -.139l-.039 -.323l-.024 -.365l-.006 -.292a7 7 0 0 1 6.76 -6.996l.24 -.004z\" />\n"};

/**
 * İsim → inline SVG string üretir.
 * @param {string} name Tabler katalog adı (ör. 'users-group').
 * @param {object} opts { size, cls, filled, strokeWidth, title }
 * @returns {string} inline `<svg>` HTML'i.
 */
export function icon(name, opts = {}) {
    const size = opts.size || 18;
    const cls = opts.cls ? ` ${opts.cls}` : '';
    const strokeWidth = opts.strokeWidth || 1.8;
    const title = opts.title
        ? `<title>${String(opts.title).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>`
        : '';
    const filled = opts.filled ? FILLED_PATHS[name] : null;
    const paths = filled || PATHS[name];
    if (!paths) {
        console.warn(`[ICONS] Bilinmeyen ikon: "${name}"`);
        return `<span class="icon-missing${cls}" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`;
    }
    if (filled) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" class="icon icon-filled${cls}" aria-hidden="true">${title}${paths}</svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="icon${cls}" aria-hidden="true">${title}${paths}</svg>`;
}

/** Erişilebilir ikon + metin etiketi kombinasyonu. */
export function iconLabel(name, label, opts = {}) {
    return `${icon(name, opts)}<span class="icon-label">${label}</span>`;
}

export const ICON_NAMES = Object.keys(PATHS);

const LEGACY_NAMES = {"expand_more":"chevron-down","content_copy":"copy","groups":"users-group","group":"users-group","smart_toy":"robot","newspaper":"news","notifications_active":"bell","settings_ethernet":"settings","group_work":"users-group","shield_person":"shield-lock","mail":"mail","admin_panel_settings":"shield-lock","verified_user":"shield-lock","badge":"id","swap_vert":"switch-vertical","add_circle":"plus","list_alt":"list","database":"database","post_add":"plus","campaign":"bell","calendar_month":"calendar","cloud_done":"check","person_remove":"user-minus","dns":"server","sync":"refresh","download_for_offline":"download","edit":"pencil","delete":"trash","close":"x","restart_alt":"refresh","block":"circle-off","visibility":"eye","tune":"adjustments","save":"device-floppy","workspace_premium":"crown","playlist_add":"plus","forum":"messages","person":"user-circle","dark_mode":"moon","light_mode":"sun","push_pin":"pin","tag":"hash","alternate_email":"at","keyboard_arrow_down":"chevron-down","keyboard_arrow_up":"chevron-up","assignment_ind":"id","logout":"logout","settings":"settings","check":"check","shield":"shield","search":"search","refresh":"refresh","article":"article","add":"plus","person_add":"user-plus","account_circle":"user-circle","diversity_3":"users-group","apps":"dots","menu":"menu-2","help":"help-circle","visibility_off":"eye-off","arrow_forward":"arrow-right","info":"info-circle","warning":"alert-triangle","error":"alert-circle"};
export function hydrateIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach(el => {
        const name = LEGACY_NAMES[el.dataset.icon] || el.dataset.icon;
        const holder = document.createElement("template");
        holder.innerHTML = icon(name, {cls:el.className});
        el.replaceWith(holder.content.firstChild);
    });
}
export function initIcons() {
    hydrateIcons();
    const observer = new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) { if (node.matches("[data-icon]")) hydrateIcons(node.parentNode); else hydrateIcons(node); } });
    observer.observe(document.body, {childList:true,subtree:true});
}
