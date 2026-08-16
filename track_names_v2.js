(function () {
    'use strict';

    var DEBUG = true; // поставьте false, чтобы убрать панель отладки внизу экрана

    // ---------- Панель отладки на экране (т.к. консоли на ТВ не видно) ----------
    var debugBox = null;
    function log(msg) {
        if (!DEBUG) return;
        try {
            if (!debugBox) {
                debugBox = document.createElement('div');
                debugBox.style.cssText =
                    'position:fixed;top:0;right:0;width:32%;max-height:28%;overflow:auto;' +
                    'background:rgba(0,0,0,0.85);color:#0f0;font-size:13px;line-height:1.25;' +
                    'padding:6px;z-index:999999;white-space:pre-wrap;font-family:monospace;' +
                    'pointer-events:none;';
                (document.body || document.documentElement).appendChild(debugBox);
            }
            var line = document.createElement('div');
            line.textContent = new Date().toLocaleTimeString() + '  ' + msg;
            debugBox.appendChild(line);
            debugBox.scrollTop = debugBox.scrollHeight;
        } catch (e) {}
    }

    log('track_names_ru_v2: плагин загружен');

    // ---------- Языковой словарь (запасной вариант, как в предыдущей версии) ----------
    var LANG_MAP = {
        rus: 'Русский', ru: 'Русский',
        eng: 'Английский', en: 'Английский',
        ukr: 'Украинский', uk: 'Украинский',
        bel: 'Белорусский',
        deu: 'Немецкий', ger: 'Немецкий', de: 'Немецкий',
        fra: 'Французский', fre: 'Французский', fr: 'Французский',
        spa: 'Испанский', es: 'Испанский',
        ita: 'Итальянский', it: 'Итальянский',
        jpn: 'Японский', ja: 'Японский',
        kor: 'Корейский', ko: 'Корейский',
        chi: 'Китайский', zho: 'Китайский', zh: 'Китайский',
        pol: 'Польский',
        tur: 'Турецкий',
        por: 'Португальский',
        und: 'Без метки языка',
        mis: 'Без метки языка'
    };

    // Названия дорожек, полученные через mediainfo.js (index -> title), если получится их достать
    var trackTitles = null; // массив строк по порядку аудиодорожек, либо null пока не готово

    function humanize(text) {
        return text.replace(/(\d+)\s*\/\s*([a-zA-Z]{2,3})\b/g, function (full, num, code) {
            var n = parseInt(num, 10);
            if (trackTitles && trackTitles[n - 1]) {
                return num + ' — ' + trackTitles[n - 1];
            }
            var key = code.toLowerCase();
            var name = LANG_MAP[key];
            if (!name) return full;
            return num + ' — ' + name;
        });
    }

    function processElement(el) {
        if (!el || el.nodeType !== 1) return;
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var node, toUpdate = [];
        while ((node = walker.nextNode())) {
            if (/\d+\s*\/\s*[a-zA-Z]{2,3}\b/.test(node.nodeValue)) toUpdate.push(node);
        }
        toUpdate.forEach(function (n) {
            var replaced = humanize(n.nodeValue);
            if (replaced !== n.nodeValue) n.nodeValue = replaced;
        });
    }

    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            m.addedNodes && m.addedNodes.forEach(function (node) { processElement(node); });
        });
    });

    function startDomWatch() {
        observer.observe(document.body, { childList: true, subtree: true });
        processElement(document.body);
    }

    // ---------- 1. Перехват сетевых запросов, чтобы найти URL потока TorrServer ----------
    var lastStreamUrl = null;

    function noteUrl(url) {
        if (typeof url === 'string' && /\/stream\/.*[?&]link=/.test(url)) {
            if (url !== lastStreamUrl) {
                lastStreamUrl = url;
                log('Найдена ссылка на поток: ' + url);
                analyzeCurrentStream();
            }
        }
    }

    var origFetch = window.fetch;
    if (origFetch) {
        window.fetch = function (input, init) {
            try {
                var url = typeof input === 'string' ? input : (input && input.url);
                noteUrl(url);
            } catch (e) {}
            return origFetch.apply(this, arguments);
        };
    }

    var OrigXHR = window.XMLHttpRequest;
    if (OrigXHR) {
        var origOpen = OrigXHR.prototype.open;
        OrigXHR.prototype.open = function (method, url) {
            try { noteUrl(url); } catch (e) {}
            return origOpen.apply(this, arguments);
        };
    }

    // Резервный способ — искать src у <video>, если он используется
    setInterval(function () {
        try {
            var v = document.querySelector('video');
            if (v && v.currentSrc) noteUrl(v.currentSrc);
        } catch (e) {}
    }, 1500);

    // ---------- 2. Загрузка mediainfo.js по требованию ----------
    var miPromise = null;
    function loadMediaInfo() {
        if (miPromise) return miPromise;
        miPromise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = 'https://unpkg.com/mediainfo.js/dist/mediainfo.min.js';
            script.onload = function () {
                try {
                    var factory = window.MediaInfo || (window.MediaInfo && window.MediaInfo.default);
                    if (!factory) { reject(new Error('MediaInfo global не найден после загрузки скрипта')); return; }
                    factory({ format: 'object', coverData: false }).then(resolve).catch(reject);
                } catch (e) { reject(e); }
            };
            script.onerror = function () { reject(new Error('Не удалось загрузить mediainfo.min.js')); };
            document.head.appendChild(script);
        });
        return miPromise;
    }

    var analyzing = false;
    function analyzeCurrentStream() {
        if (analyzing) return;
        if (!lastStreamUrl) return;
        analyzing = true;
        var targetUrl = lastStreamUrl;

        log('Запрашиваю размер файла (HEAD)...');
        fetch(targetUrl, { method: 'HEAD' }).then(function (resp) {
            var size = parseInt(resp.headers.get('content-length') || '0', 10);
            if (!size) throw new Error('Сервер не вернул content-length');
            log('Размер файла: ' + size + ' байт. Загружаю mediainfo.js...');
            return loadMediaInfo().then(function (mediainfo) {
                log('mediainfo.js загружен, анализирую заголовок файла...');
                function readChunk(chunkSize, offset) {
                    return fetch(targetUrl, {
                        headers: { Range: 'bytes=' + offset + '-' + (offset + chunkSize - 1) }
                    }).then(function (r) {
                        if (!r.ok && r.status !== 206) throw new Error('Range-запрос вернул статус ' + r.status);
                        return r.arrayBuffer();
                    }).then(function (buf) { return new Uint8Array(buf); });
                }
                return mediainfo.analyzeData(function () { return size; }, readChunk);
            });
        }).then(function (result) {
            log('Анализ завершён, ищу аудиодорожки...');
            var tracks = (result && result.media && result.media.track) || [];
            var audioTracks = tracks.filter(function (t) { return t['@type'] === 'Audio'; });
            if (!audioTracks.length) { log('Аудиодорожки не найдены в metadata'); analyzing = false; return; }

            trackTitles = audioTracks.map(function (t) {
                return t.Title || t.title || null;
            });
            log('Названия дорожек: ' + JSON.stringify(trackTitles));

            // Перерисовать уже открытое меню, если оно есть
            processElement(document.body);
            analyzing = false;
        }).catch(function (err) {
            log('Ошибка анализа: ' + (err && err.message ? err.message : err));
            analyzing = false;
        });
    }

    if (document.body) startDomWatch();
    else document.addEventListener('DOMContentLoaded', startDomWatch);
})();
