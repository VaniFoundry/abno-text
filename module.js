let intervalId = null;
let sequenceIndex = 0;
let activeMessages = [];

/* ---------------------------- */
/* Register Settings             */
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
      randomPosition: true,
      randomAngle: true,
      maxAngle: 25,
      autoScaleLongText: true,
      preventOverlap: true,
      maxSimultaneous: 3
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
/* Message Selection             */
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
/* Main Display Function         */
/* ---------------------------- */

export function showAbnoMessage(text) {

  const config = game.settings.get("abno-text", "config");

  if (config.preventOverlap && activeMessages.length >= config.maxSimultaneous) {
    return; // Hard cap
  }

  const overlay = $(`<div class="abno-overlay"></div>`);
  const textElement = $(`<div class="abno-text"></div>`);

  overlay.append(textElement);

  // Append to canvas instead of body (behind UI)
  document.body.appendChild(overlay[0]);

  textElement.css({
    "font-size": config.fontSize + "px",
    "color": config.color,
    "font-family": config.fontFamily,
    "position": "absolute",
    "max-width": "90vw",
    "max-height": "90vh",
    "overflow-wrap": "break-word",
    "word-break": "break-word",
    "white-space": "normal",
    "text-align": "center"
  });

  positionMessage(textElement, config);

  if (config.randomAngle) {
    const angle = (Math.random() * config.maxAngle * 2) - config.maxAngle;
    textElement.css({
      transform: `rotate(${angle}deg)`
    });
  }

  /* Typing Effect */
  let i = 0;
  const typingInterval = setInterval(() => {
    textElement.text(text.slice(0, i));
    i++;

    if (i > text.length) {
      clearInterval(typingInterval);

      if (config.autoScaleLongText) {
        autoScaleText(textElement);
      }

      startLifetimeTimer(overlay, config);
    }

  }, config.typingSpeed);

  activeMessages.push(overlay);
}

/* ---------------------------- */
/* Positioning + Overlap Check   */
/* ---------------------------- */

function positionMessage(element, config) {

  if (!config.randomPosition) {
    element.css({
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)"
    });
    return;
  }

  let tries = 0;
  let placed = false;

  while (!placed && tries < 15) {

    const x = Math.random() * (window.innerWidth * 0.7);
    const y = Math.random() * (window.innerHeight * 0.7);

    element.css({ left: x + "px", top: y + "px" });

    placed = !isOverlapping(element);

    tries++;
  }
}

function isOverlapping(element) {

  const rect1 = element[0].getBoundingClientRect();

  for (let msg of activeMessages) {
    const rect2 = msg[0].getBoundingClientRect();

    if (!(rect1.right < rect2.left ||
          rect1.left > rect2.right ||
          rect1.bottom < rect2.top ||
          rect1.top > rect2.bottom)) {
      return true;
    }
  }

  return false;
}

/* ---------------------------- */
/* Lifetime + Fade               */
/* ---------------------------- */

function startLifetimeTimer(overlay, config) {

  setTimeout(() => {

    overlay.fadeOut(config.fadeOutTime, () => {
      activeMessages = activeMessages.filter(m => m !== overlay);
      overlay.remove();
    });

  }, config.duration);
}

/* ---------------------------- */
/* Auto Scaling                  */
/* ---------------------------- */

function autoScaleText(element) {

  let fontSize = parseInt(element.css("font-size"));

  while (
    (element[0].scrollWidth > window.innerWidth * 0.9 ||
     element[0].scrollHeight > window.innerHeight * 0.9)
     && fontSize > 12
  ) {
    fontSize -= 2;
    element.css("font-size", fontSize + "px");
  }
}

/* ---------------------------- */
/* Auto Play                     */
/* ---------------------------- */

function playNextMessage() {
  const msg = getNextMessage();
  if (msg) showAbnoMessage(msg);
}

function startAutoMessages() {

  const config = game.settings.get("abno-text", "config");

  if (intervalId) clearInterval(intervalId);

  if (config.frequency > 0) {
    intervalId = setInterval(() => {
      playNextMessage();
    }, config.frequency * 1000);
  }
}

/* ---------------------------- */
/* Config Form                   */
/* ---------------------------- */

class AbnoTextConfig extends FormApplication {

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "abno-text-config",
      title: "Abno-Text Configuration",
      template: "modules/abno-text/templates/settings.html",
      width: 650,
      height: "auto"
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

    data.randomPosition = !!formData.randomPosition;
    data.randomAngle = !!formData.randomAngle;
    data.randomMode = !!formData.randomMode;
    data.autoScaleLongText = !!formData.autoScaleLongText;
    data.preventOverlap = !!formData.preventOverlap;

    await game.settings.set("abno-text", "config", data);

    sequenceIndex = 0;
    startAutoMessages();
  }
}
