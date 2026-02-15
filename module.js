let intervalId = null;
let sequenceIndex = 0;

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
        "Something watches from beyond.",
        "Fate tightens its grip upon reality."
      ],
      duration: 5000,
      frequency: 0,
      fontSize: 64,
      color: "#ff3333",
      fontFamily: "serif",
      typingSpeed: 40,
      randomMode: false,
      randomPosition: true,
      randomAngle: true,
      maxAngle: 25,
      autoScaleLongText: true
    }
  });

  game.settings.registerMenu("abno-text", "configMenu", {
    name: "Abno-Text Configuration",
    label: "Open Configuration",
    type: AbnoTextConfig,
    restricted: true
  });

});


/* ---------------------------- */
/* Ready                         */
/* ---------------------------- */

Hooks.once("ready", () => {
  startAutoMessages();
});


/* ---------------------------- */
/* Message Selection Logic       */
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
/* Show Message                  */
/* ---------------------------- */

export function showAbnoMessage(text) {

  const config = game.settings.get("abno-text", "config");

  const overlay = $(`<div class="abno-overlay"></div>`);
  const textElement = $(`<div class="abno-text"></div>`);

  overlay.append(textElement);
  $("body").append(overlay);

  /* Base styling */
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

  /* Position */
  if (config.randomPosition) {
    const x = Math.random() * (window.innerWidth * 0.6);
    const y = Math.random() * (window.innerHeight * 0.6);
    textElement.css({
      left: x + "px",
      top: y + "px"
    });
  } else {
    textElement.css({
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)"
    });
  }

  /* Rotation */
  if (config.randomAngle) {
    const angle = (Math.random() * config.maxAngle * 2) - config.maxAngle;
    textElement.css({
      transform: `rotate(${angle}deg)`
    });
  }

  /* Typewriter */
  let i = 0;
  const typingInterval = setInterval(() => {
    textElement.text(text.slice(0, i));
    i++;

    if (i > text.length) {
      clearInterval(typingInterval);

      /* Auto scale long text AFTER full render */
      if (config.autoScaleLongText) {
        autoScaleText(textElement);
      }
    }

  }, config.typingSpeed);

  setTimeout(() => {
    overlay.fadeOut(500, () => overlay.remove());
  }, config.duration);
}


/* ---------------------------- */
/* Auto Scaling Logic            */
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
/* Play Next                     */
/* ---------------------------- */

function playNextMessage() {
  const msg = getNextMessage();
  if (msg) showAbnoMessage(msg);
}


/* ---------------------------- */
/* Auto Interval                 */
/* ---------------------------- */

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
      width: 600,
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

    await game.settings.set("abno-text", "config", data);

    sequenceIndex = 0;
    startAutoMessages();
  }
}
