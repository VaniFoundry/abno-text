let intervalId = null;

/* ---------------------------- */
/*  Register Settings           */
/* ---------------------------- */

Hooks.once("init", () => {
  game.settings.register("abno-text", "config", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      messages: [
        "The air trembles...",
        "Something approaches.",
        "Fate turns its gaze upon you."
      ],
      duration: 3000,
      frequency: 0, // 0 = disabled
      fontSize: 64,
      color: "#ff3333",
      fontFamily: "serif"
    }
  });

  game.settings.registerMenu("abno-text", "configMenu", {
    name: "Dramatic Messages Settings",
    label: "Configure Messages",
    type: DramaticMessagesConfig,
    restricted: true
  });
});


/* ---------------------------- */
/*  Ready Hook                  */
/* ---------------------------- */

Hooks.once("ready", () => {
  startAutoMessages();
});


/* ---------------------------- */
/*  Overlay Function            */
/* ---------------------------- */

export function showDramaticMessage(text) {
  const config = game.settings.get("abno-text", "config");

  const overlay = $(`
    <div class="dramatic-overlay">
      <div class="dramatic-text">${text}</div>
    </div>
  `);

  overlay.find(".dramatic-text").css({
    "font-size": config.fontSize + "px",
    "color": config.color,
    "font-family": config.fontFamily
  });

  $("body").append(overlay);

  setTimeout(() => {
    overlay.fadeOut(500, () => overlay.remove());
  }, config.duration);
}


/* ---------------------------- */
/*  Random Message              */
/* ---------------------------- */

function playRandomMessage() {
  const config = game.settings.get("abno-text", "config");
  if (!config.messages.length) return;

  const random = config.messages[Math.floor(Math.random() * config.messages.length)];
  showDramaticMessage(random);
}


/* ---------------------------- */
/*  Auto Interval               */
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
/*  Settings Form               */
/* ---------------------------- */

class DramaticMessagesConfig extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "abno-text-config",
      title: "Dramatic Messages Configuration",
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

    await game.settings.set("abno-text", "config", data);

    startAutoMessages();
  }
}
