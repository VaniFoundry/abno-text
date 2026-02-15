let intervalId = null;
let sequenceIndex = 0;
let activeRects = [];

/* ---------------------------- */
/* SETTINGS                     */
/* ---------------------------- */

Hooks.once("init", () => {

  game.settings.register("abno-text", "config", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      messages: [
        "The air trembles...",
        "Something watches.",
        "Fate tightens."
      ],
      duration: 4000,
      fadeOutTime: 600,
      frequency: 0,
      fontSize: 64,
      color: "#ff3333",
      fontFamily: "serif",
      typingSpeed: 40,
      randomMode: false,
      randomAngle: true,
      maxAngle: 25,
      autoScaleLongText: true,
      maxSimultaneous: 3,

      outlineEnabled: true,
      outlineColor: "#000000",
      outlineThickness: 3
    }
  });

  game.settings.registerMenu("abno-text", "configMenu", {
    name: "Abno-Text Configuration",
    label: "Open Configuration",
    type: AbnoTextConfig,
    restricted: true
  });

});

Hooks.once("ready", () => {
  startAutoMessages();
});

/* ---------------------------- */
/* MESSAGE PICKING              */
/* ---------------------------- */

function getNextMessage() {
  const config = game.settings.get("abno-text", "config");
  if (!config.messages.length) return null;

  if (config.randomMode) {
    return config.messages[Math.floor(Math.random() * config.messages.length)];
  }

  const msg = config.messages[sequenceIndex];
  sequenceIndex = (sequenceIndex + 1) % config.messages.length;
  return msg;
}

/* ---------------------------- */
/* SHOW MESSAGE                 */
/* ---------------------------- */

export function showAbnoMessage(text) {

  const config = game.settings.get("abno-text", "config");

  if (activeRects.length >= config.maxSimultaneous) return;

  const overlay = $(`<div class="abno-overlay"></div>`);
  const textElement = $(`<div class="abno-text"></div>`);

  overlay.append(textElement);
  document.body.appendChild(overlay[0]);

  overlay.css({ opacity: 0 });

  textElement.css({
    position: "absolute",
    fontSize: config.fontSize + "px",
    color: config.color,
    fontFamily: config.fontFamily,
    maxWidth: "90vw",
    whiteSpace: "normal",
    textAlign: "center",
    textShadow: config.outlineEnabled ? generateOutline(config) : "none"
  });

  // Put full text temporarily to measure size
  textElement.text(text);

  if (config.autoScaleLongText) {
    autoScaleText(textElement[0]);
  }

  const placedRect = placeWithoutOverlap(textElement);

  if (!placedRect) {
    overlay.remove();
    return;
  }

  activeRects.push(placedRect);

  // Apply random rotation AFTER placement
  if (config.randomAngle) {
    const angle = (Math.random() * config.maxAngle * 2) - config.maxAngle;
    textElement.css("transform", `rotate(${angle}deg)`);
  }

  overlay.animate({ opacity: 1 }, 150);

  // Clear for typing
  textElement.text("");

  let i = 0;

  const typingInterval = setInterval(() => {
    textElement.text(text.slice(0, i));
    i++;

    if (i > text.length) {
      clearInterval(typingInterval);
      startLifetimeTimer(overlay, placedRect, config);
    }
  }, config.typingSpeed);
}

/* ---------------------------- */
/* PERFECT PLACEMENT SYSTEM     */
/* ---------------------------- */

function placeWithoutOverlap(element) {

  element[0].offsetWidth;

  const rect = element[0].getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  const maxX = window.innerWidth - width;
  const maxY = window.innerHeight - height;

  if (maxX <= 0 || maxY <= 0) return null;

  let tries = 0;

  while (tries < 50) {

    const x = Math.random() * maxX;
    const y = Math.random() * maxY;

    element.css({
      left: x + "px",
      top: y + "px"
    });

    const newRect = element[0].getBoundingClientRect();

    let overlaps = false;

    for (let r of activeRects) {
      if (!(newRect.right < r.left ||
            newRect.left > r.right ||
            newRect.bottom < r.top ||
            newRect.top > r.bottom)) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      return newRect;
    }

    tries++;
  }

  return null;
}

/* ---------------------------- */
/* LIFETIME                     */
/* ---------------------------- */

function startLifetimeTimer(overlay, rect, config) {

  setTimeout(() => {

    overlay.fadeOut(config.fadeOutTime, () => {

      activeRects = activeRects.filter(r =>
        !(r.left === rect.left &&
          r.top === rect.top &&
          r.right === rect.right &&
          r.bottom === rect.bottom)
      );

      overlay.remove();

    });

  }, config.duration);
}

/* ---------------------------- */
/* OUTLINE                      */
/* ---------------------------- */

function generateOutline(config) {

  const thickness = config.outlineThickness;
  const color = config.outlineColor;
  const shadows = [];

  for (let x = -thickness; x <= thickness; x++) {
    for (let y = -thickness; y <= thickness; y++) {
      if (x !== 0 || y !== 0) {
        shadows.push(`${x}px ${y}px 0 ${color}`);
      }
    }
  }

  return shadows.join(",");
}

/* ---------------------------- */
/* AUTO SCALE                   */
/* ---------------------------- */

function autoScaleText(element) {

  let size = parseInt(window.getComputedStyle(element).fontSize);

  while (
    (element.scrollWidth > window.innerWidth * 0.95 ||
     element.scrollHeight > window.innerHeight * 0.95)
     && size > 12
  ) {
    size -= 2;
    element.style.fontSize = size + "px";
  }
}

/* ---------------------------- */
/* AUTO PLAY                    */
/* ---------------------------- */

function playNextMessage() {
  const msg = getNextMessage();
  if (msg) showAbnoMessage(msg);
}

function startAutoMessages() {

  const config = game.settings.get("abno-text", "config");

  if (intervalId) clearInterval(intervalId);

  if (config.frequency > 0) {
    intervalId = setInterval(playNextMessage, config.frequency * 1000);
  }
}

/* ---------------------------- */
/* CONFIG FORM                  */
/* ---------------------------- */

class AbnoTextConfig extends FormApplication {

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "abno-text-config",
      title: "Abno-Text Configuration",
      template: "modules/abno-text/templates/settings.html",
      width: 650
    });
  }

  getData() {
    return game.settings.get("abno-text", "config");
  }

  async _updateObject(event, formData) {

    const data = expandObject(formData);

    data.messages = data.messages
      .split("\n")
      .map(m => m.trim())
      .filter(m => m.length > 0);

    data.randomMode = !!formData.randomMode;
    data.randomAngle = !!formData.randomAngle;
    data.autoScaleLongText = !!formData.autoScaleLongText;
    data.outlineEnabled = !!formData.outlineEnabled;

    await game.settings.set("abno-text", "config", data);

    sequenceIndex = 0;
    startAutoMessages();
  }
}
