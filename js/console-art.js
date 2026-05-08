
(function() {
  if (typeof window === 'undefined' || !window.console) return;
  if (window._spoitoConsoleInit) return;
  window._spoitoConsoleInit = true;

  const C = {
    O:    '#FF6B1A',
    OD:   '#D94F08',
    INK:  '#3A1F0A',
    INK2: '#6C4628',
    Y:    '#FFD43A',
    G:    '#5AC882',
    B:    '#5EB8F0',
    P:    '#8C5CC8',
    PINK: '#FA82B4',
    R:    '#FF5050',
    K:    '#1A1A1A'
  };

  const S = {
    logo:    `color:${C.O};font-family:'JetBrains Mono','Courier New',monospace;font-weight:800;font-size:13px;line-height:1.15;text-shadow:1px 1px 0 rgba(217,79,8,0.4);`,
    chip:    `background:${C.O};color:#fff;font-weight:800;padding:6px 14px;border-radius:999px;font-size:13px;font-family:sans-serif;`,
    sub:     `color:${C.INK2};font-size:12px;font-family:sans-serif;`,
    greet:   `color:${C.OD};font-size:15px;font-weight:800;font-family:sans-serif;padding:4px 0;`,
    sect:    `color:${C.O};font-size:11px;font-weight:800;font-family:'JetBrains Mono',monospace;letter-spacing:0.15em;`,
    label:   `color:${C.O};font-weight:800;font-size:12px;font-family:'JetBrains Mono',monospace;`,
    val:     `color:${C.INK};font-size:12px;font-family:'JetBrains Mono',monospace;`,
    cmd:     `background:${C.INK};color:${C.Y};font-weight:800;padding:3px 10px;border-radius:4px;font-size:12px;font-family:'JetBrains Mono',monospace;`,
    cmdDesc: `color:${C.INK2};font-size:12px;font-family:sans-serif;padding-left:8px;`,
    rule:    `color:${C.O};font-family:monospace;font-size:11px;`,
    hint:    `color:${C.INK2};font-size:11px;font-style:italic;font-family:sans-serif;`,
    pal:     (c) => `background:${c};padding:7px 14px;font-size:0;line-height:1;`,
    flag:    `font-size:14px;`,
    word:    `color:${C.INK};font-size:13px;font-weight:700;font-family:sans-serif;padding-left:6px;`
  };

  function rainbow(text, size) {
    const colors = [C.R, C.O, C.Y, C.G, C.B, C.P];
    let str = '';
    const arr = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      str += '%c' + ch;
      if (ch === ' ') {
        arr.push('font-size:' + size + 'px;');
      } else {
        arr.push(`color:${colors[i % colors.length]};font-size:${size}px;font-weight:800;text-shadow:1px 1px 0 rgba(0,0,0,0.18);font-family:sans-serif;`);
      }
    }
    return [str, ...arr];
  }

  function greeting() {
    const h = new Date().getHours();
    let en, ja;
    if (h < 6)        { en = 'Working late?';  ja = '夜更かしお疲れさま'; }
    else if (h < 12)  { en = 'Good morning';   ja = 'おはようございます'; }
    else if (h < 18)  { en = 'Hello there';    ja = 'こんにちは'; }
    else              { en = 'Good evening';   ja = 'こんばんは'; }
    return { en, ja };
  }

  const art = '\n' +
'   ███████╗██████╗  ██████╗ ██╗████████╗ ██████╗\n' +
'   ██╔════╝██╔══██╗██╔═══██╗██║╚══██╔══╝██╔═══██╗\n' +
'   ███████╗██████╔╝██║   ██║██║   ██║   ██║   ██║\n' +
'   ╚════██║██╔═══╝ ██║   ██║██║   ██║   ██║   ██║\n' +
'   ███████║██║     ╚██████╔╝██║   ██║   ╚██████╔╝\n' +
'   ╚══════╝╚═╝      ╚═════╝ ╚═╝   ╚═╝    ╚═════╝\n';

  console.log('%c' + art, S.logo);
  console.log(...rainbow('   Spoito-cho', 24));
  console.log('%c   Color picker tool for Tomodachi Life paint mode', S.sub);
  console.log('');

  console.log(
    '%c     %c     %c     %c     %c     %c     %c     %c     %c     %c     ',
    S.pal(C.R), S.pal(C.O), S.pal(C.Y), S.pal(C.G),
    S.pal(C.B), S.pal(C.P), S.pal(C.PINK), S.pal('#A57340'),
    S.pal(C.K), S.pal('#F2F2F2')
  );
  console.log('');

  const g = greeting();
  console.log(`%c👋 ${g.en}, curious developer!`, S.greet);
  console.log(`%c${g.ja}、コードを覗いてくれてありがとう。`, S.sub);
  console.log('');

  console.log('%c━━ ABOUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', S.sect);
  console.log('%c GitHub  ', S.label, '%c https://github.com/Yu08083/Tomodachi-Life-Palette-Tool', S.val);
  console.log('%c Author  ', S.label, '%c @yu_   on  X', S.val);
  console.log('%c License ', S.label, '%c MIT  —  fork & modify freely', S.val);
  console.log('%c Stack   ', S.label, '%c Vanilla JS · HTML · CSS  (no framework, no tracker)', S.val);
  console.log('%c Scope   ', S.label, '%c 12 languages · 84-color palette · zero server', S.val);
  console.log('');

  console.log('%c━━ TRY THESE ━━━━━━━━━━━━━━━━━━━━━━━━━━━', S.sect);
  console.log('%c spoito.about()  ', S.cmd, '%cAbout this project', S.cmdDesc);
  console.log('%c spoito.colors() ', S.cmd, '%cView all 84 palette colors', S.cmdDesc);
  console.log('%c spoito.thanks() ', S.cmd, '%cThanks in 12 languages', S.cmdDesc);
  console.log('%c spoito.help()   ', S.cmd, '%cAll available commands', S.cmdDesc);
  console.log('');

  console.log('%c   No images leave your browser. Everything runs locally.', S.hint);
  console.log('%c   画像はあなたのブラウザの外には出ません。すべてローカル処理。', S.hint);
  console.log('');

  function _rule() {
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', S.rule);
  }

  const VERSION = '1.0.0';

  const api = {
    get version() { return VERSION; },

    about() {
      _rule();
      console.log(...rainbow(' Spoito-cho ', 20));
      console.log('');
      console.log('%cすぽいと帳 / Spoito-cho', S.greet);
      console.log('%cA pixel-art-friendly color picker for Tomodachi Life paint mode.', S.val);
      console.log('');
      console.log('%cFEATURES', S.sect);
      console.log('%c  ▸ ', S.label, '%cPick colors from any image, find best 84-palette match', S.val);
      console.log('%c  ▸ ', S.label, '%cFull-color HSV navigator with step-by-step operation guide', S.val);
      console.log('%c  ▸ ', S.label, '%cExport as pixel art PNG or paint-by-numbers PNG', S.val);
      console.log('%c  ▸ ', S.label, '%cFavorite colors · image history · cropping · dithering', S.val);
      console.log('%c  ▸ ', S.label, '%c12 languages — auto-detected from your browser', S.val);
      console.log('%c  ▸ ', S.label, '%cZero server · zero analytics · zero tracking', S.val);
      _rule();
      return '';
    },

    colors() {
      if (typeof PALETTE === 'undefined') {
        console.warn('PALETTE is not loaded yet. Try again in a moment.');
        return '';
      }
      _rule();
      console.log('%cTomodachi Life — 84-color palette', S.greet);
      console.log('%c12 columns × 7 rows  ·  numbered 1–84 (left→right, top→bottom)', S.sub);
      console.log('');

      let str = '';
      const styles = [];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 12; col++) {
          const idx = row * 12 + col;
          if (PALETTE[idx]) {
            str += '%c      ';
            styles.push(`background:${PALETTE[idx].h};padding:8px;font-size:0;line-height:1;`);
          }
        }
        str += '\n';
      }
      console.log(str, ...styles);

      console.log('%cFull data (sortable in DevTools)', S.sect);
      console.table(PALETTE.map((p, i) => ({
        '#':   i + 1,
        hex:   p.h.toUpperCase(),
        row:   p.row + 1,
        col:   p.col + 1
      })));
      _rule();
      return '';
    },

    thanks() {
      _rule();
      console.log('%c💛 Thanks for being here!', S.greet);
      console.log('%c12 languages of gratitude:', S.sub);
      console.log('');
      const greetings = [
        ['🇯🇵', 'ja',    'ありがとう'],
        ['🌍', 'en',    'Thank you'],
        ['🇰🇷', 'ko',    '감사합니다'],
        ['🇫🇷', 'fr',    'Merci'],
        ['🇪🇸', 'es',    'Gracias'],
        ['🇹🇼', 'zh-TW', '謝謝'],
        ['🇨🇳', 'zh-CN', '谢谢'],
        ['🇩🇪', 'de',    'Danke'],
        ['🇮🇹', 'it',    'Grazie'],
        ['🇳🇱', 'nl',    'Bedankt'],
        ['🇧🇷', 'pt-BR', 'Obrigado'],
        ['🇷🇺', 'ru',    'Спасибо']
      ];
      greetings.forEach((row) => {
        const flag = row[0], code = row[1], word = row[2];
        console.log(
          '%c ' + flag + ' %c ' + code.padEnd(6) + ' %c' + word,
          S.flag, S.label, S.word
        );
      });
      console.log('');
      console.log('%cTo Tomodachi Life players around the world,', S.sub);
      console.log('%cand to anyone reading source code: you rock. ✨', S.sub);
      _rule();
      return '';
    },

    help() {
      _rule();
      console.log('%cAvailable commands', S.greet);
      console.log('');
      console.log('%c spoito.about()  ', S.cmd, '%cAbout this project', S.cmdDesc);
      console.log('%c spoito.colors() ', S.cmd, '%cView all 84 palette colors', S.cmdDesc);
      console.log('%c spoito.thanks() ', S.cmd, '%cThanks in 12 languages', S.cmdDesc);
      console.log('%c spoito.help()   ', S.cmd, '%cThis message', S.cmdDesc);
      console.log('%c spoito.version  ', S.cmd, '%cVersion info', S.cmdDesc);
      _rule();
      return '';
    }
  };

  Object.defineProperty(window, 'spoito', {
    value: Object.freeze(api),
    writable: false,
    configurable: false
  });
})();
