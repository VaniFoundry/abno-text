let intervalId = null;

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
        "Fate tightens its grip."
      ],
      duration: 4000,
      frequency: 0,
      fontSize: 64,
      color: "#ff3333",
      fontFamily: "serif",
      typingSpeed: 40,
      randomPosition: true,
      randomAngle: true,
      maxAngle: 25
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
/* Ready Hook                    */
/* ---------------------------- */

Hooks.once("ready", () => {
  startAutoMessages();
});


/* ---------------------------- */
/* Show Message                  */
/* ---------------------------- */

export function showAbnoMessage(text) {

  const config = game.settings.get("abno-text", "config");

  const overlay = $(`<div class="abno-overlay"></div>`);
  const textElement = $(`<div class="abno-text"></div>`);

  overlay.append(textElement);
  $("body").append(overlay);

  textElement.css({
    "font-size": config.fontSize + "px",
    "color": config.color,
    "font-family": config.fontFamily,
    "position": "absolute"
  });

  /* Random Position */
  if (config.randomPosition) {
    const x = Math.random() * (window.innerWidth * 0.8);
    const y = Math.random() * (window.innerHeight * 0.8);
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

  /* Random Angle */
  if (config.randomAngle) {
    const angle = (Math.random() * config.maxAngle * 2) - config.maxAngle;
    textElement.css({
      transform: `rotate(${angle}deg)`
    });
  }

  /* Typewriter Effect */
  let i = 0;
  const typingInterval = setInterval(() => {
    textElement.text(text.slice(0, i));
    i++;

    if (i > text.length) {
      clearInterval(typingInterval);
    }
  }, config.typingSpeed);

  /* Remove After Duration */
  setTimeout(() => {
    overlay.fadeOut(500, () => overlay.remove());
  }, config.duration);
}


/* ---------------------------- */
/* Random Message                */
/* ---------------------------- */

function playRandomMessage() {
  const config = game.settings.get("abno-text", "config");
  if (!config.messages.length) return;

  const random = config.messages[Math.floor(Math.random() * config.messages.length)];
  showAbnoMessage(random);
}


/* ---------------------------- */
/* Auto Interval                 */
/* ---------------------------- */

function startAutoMessages() {
  const config = game.settings.get("abno-text", "config");

  if (intervalId) clearInterval(intervalId);

  if (config.frequency > 0) {
    intervalId = setInterval(() => {
      playRandomMessage();
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

    await game.settings.set("abno-text", "config", data);

    startAutoMessages();
  }
}
