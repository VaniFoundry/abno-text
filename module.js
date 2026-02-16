console.log("ABNO TEXT MODULE LOADED");

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
      messages: ["The air trembles...", "Something watches.", "Fate tightens."],
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

  game.settings.register("abno-text", "enabled", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register("abno-text", "loadouts", {
    scope: "world",
    config: false,
    type: Object,
    default: { custom: {} }
  });

  game.settings.register("abno-text", "activeLoadout", {
    scope: "world",
    config: false,
    type: String,
    default: "default"
  });

  game.settings.registerMenu("abno-text", "configMenu", {
    name: "Abno-Text Configuration",
    label: "Open Configuration",
    type: AbnoTextConfig,
    restricted: true
  });
});


/* ---------------------------- */
/* READY                        */
/* ---------------------------- */
Hooks.once("ready", () => {
  if (game.settings.get("abno-text", "enabled")) startAutoMessages();
  console.log("ABNO: Module ready, enabled =", game.settings.get("abno-text", "enabled"));
});


/* ---------------------------- */
/* SCENE CONTROLS (V13 FINAL)   */
/* ---------------------------- */
Hooks.on("getSceneControlButtons", (controls) => {
  console.log("ABNO: getSceneControlButtons hook fired");
  console.log("ABNO: controls type:", typeof controls);
  console.log("ABNO: User is GM?", game.user.isGM);
  
  if (!game.user.isGM) {
    console.log("ABNO: User is not GM, skipping");
    return;
  }

  // En v13, controls es un objeto indexado por nombre
  // Crear nuestro propio grupo de controles
  controls.abnoText = {
    name: "abnoText",
    title: "Abno Text",
    icon: "fas fa-comment",
    visible: true,
    layer: "controls",
    activeTool: "toggle",
    tools: {
      toggle: {
        name: "toggle",
        title: "Enable/Disable Abno-Text",
        icon: "fas fa-power-off",
        toggle: true,
        active: game.settings.get("abno-text", "enabled"),
        onClick: async (toggled) => {
          console.log("ABNO: Toggle clicked, new state:", toggled);
          await game.settings.set("abno-text", "enabled", toggled);
          
          if (!toggled && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (toggled) startAutoMessages();
          
          ui.controls.render();
        }
      },
      loadouts: {
        name: "loadouts",
        title: "Open Abno-Text Loadouts",
        icon: "fas fa-scroll",
        button: true,
        onClick: () => {
          console.log("ABNO: Loadouts button clicked");
          new AbnoLoadoutMenu().render(true);
        }
      },
      config: {
        name: "config",
        title: "Open Abno-Text Configuration",
        icon: "fas fa-cog",
        button: true,
        onClick: () => {
          console.log("ABNO: Config button clicked");
          new AbnoTextConfig().render(true);
        }
      }
    }
  };
  
  console.log("ABNO: Control group added successfully");
});


/* ---------------------------- */
/* MESSAGE FUNCTIONS             */
/* ---------------------------- */
function getNextMessage() {
  const config = game.settings.get("abno-text", "config");
  if (!config.messages.length) return null;
  if (config.randomMode) return config.messages[Math.floor(Math.random() * config.messages.length)];
  const msg = config.messages[sequenceIndex];
  sequenceIndex = (sequenceIndex + 1) % config.messages.length;
  return msg;
}

function showAbnoMessage(text) {
  if (!game.settings.get("abno-text", "enabled")) return;

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

  textElement.text(text);
  if (config.autoScaleLongText) autoScaleText(textElement[0]);

  const rotationDeg = config.randomAngle ? (Math.random() * config.maxAngle * 2) - config.maxAngle : 0;
  const placedRect = placeWithoutOverlap(textElement, rotationDeg);
  if (!placedRect) return overlay.remove();

  activeRects.push(placedRect);
  textElement.css("transform", `rotate(${rotationDeg}deg)`);
  overlay.animate({ opacity: 1 }, 150);

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
/* PLACEMENT + LIFETIME          */
/* ---------------------------- */
function placeWithoutOverlap(element, rotationDeg = 0) {
  element[0].offsetWidth;
  const rect = element[0].getBoundingClientRect();
  const angle = rotationDeg * Math.PI / 180;
  const rotatedWidth = Math.abs(rect.width * Math.cos(angle)) + Math.abs(rect.height * Math.sin(angle));
  const rotatedHeight = Math.abs(rect.width * Math.sin(angle)) + Math.abs(rect.height * Math.cos(angle));
  const maxX = window.innerWidth - rotatedWidth;
  const maxY = window.innerHeight - rotatedHeight;
  if (maxX <= 0 || maxY <= 0) return null;

  let tries = 0;
  while (tries < 50) {
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    element.css({ left: x + "px", top: y + "px", transform: `rotate(${rotationDeg}deg)` });
    const newRect = element[0].getBoundingClientRect();
    const overlaps = activeRects.some(r => !(newRect.right < r.left || newRect.left > r.right || newRect.bottom < r.top || newRect.top > r.bottom));
    if (!overlaps) return newRect;
    tries++;
  }
  return null;
}

function startLifetimeTimer(overlay, rect, config) {
  setTimeout(() => {
    overlay.fadeOut(config.fadeOutTime, () => {
      activeRects = activeRects.filter(r => !(r.left === rect.left && r.top === rect.top && r.right === rect.right && r.bottom === rect.bottom));
      overlay.remove();
    });
  }, config.duration);
}

function generateOutline(config) {
  const shadows = [];
  for (let x = -config.outlineThickness; x <= config.outlineThickness; x++) {
    for (let y = -config.outlineThickness; y <= config.outlineThickness; y++) {
      if (x !== 0 || y !== 0) shadows.push(`${x}px ${y}px 0 ${config.outlineColor}`);
    }
  }
  return shadows.join(",");
}

function autoScaleText(element) {
  let size = parseInt(window.getComputedStyle(element).fontSize);
  while ((element.scrollWidth > window.innerWidth * 0.95 || element.scrollHeight > window.innerHeight * 0.95) && size > 12) {
    size -= 2;
    element.style.fontSize = size + "px";
  }
}

function playNextMessage() {
  const msg = getNextMessage();
  if (msg) showAbnoMessage(msg);
}

function startAutoMessages() {
  if (!game.settings.get("abno-text", "enabled")) return;
  const config = game.settings.get("abno-text", "config");
  if (intervalId) clearInterval(intervalId);
  if (config.frequency > 0) intervalId = setInterval(playNextMessage, config.frequency * 1000);
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
    data.messages = data.messages.split("\n").map(m => m.trim()).filter(m => m.length > 0);
    data.randomMode = !!formData.randomMode;
    data.randomAngle = !!formData.randomAngle;
    data.autoScaleLongText = !!formData.autoScaleLongText;
    data.outlineEnabled = !!formData.outlineEnabled;
    await game.settings.set("abno-text", "config", data);
    sequenceIndex = 0;
    startAutoMessages();
  }
}

/* ---------------------------- */
/* LOADOUT MENU                 */
/* ---------------------------- */
class AbnoLoadoutMenu extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, { 
      id: "abno-loadout-menu", 
      title: "Abno-Text Loadouts", 
      template: "modules/abno-text/templates/loadouts.html", 
      width: 500 
    });
  }
  
  getData() {
    return { 
      loadouts: game.settings.get("abno-text", "loadouts"), 
      activeLoadout: game.settings.get("abno-text", "activeLoadout") 
    };
  }
  
  async _updateObject(event, formData) {
    const loadouts = foundry.utils.duplicate(game.settings.get("abno-text", "loadouts"));
    const currentConfig = game.settings.get("abno-text", "config");

    if (formData.addLoadout) {
      const name = formData.addLoadoutName?.trim();
      if (name) loadouts.custom[name] = currentConfig;
      await game.settings.set("abno-text", "loadouts", loadouts);
    }
    if (formData.deleteLoadout) {
      delete loadouts.custom[formData.deleteLoadout];
      await game.settings.set("abno-text", "loadouts", loadouts);
    }
    if (formData.activateLoadout) {
      if (formData.activateLoadout === "default") {
        await game.settings.set("abno-text", "activeLoadout", "default");
      } else {
        const selected = loadouts.custom[formData.activateLoadout];
        if (selected) {
          await game.settings.set("abno-text", "config", selected);
          await game.settings.set("abno-text", "activeLoadout", formData.activateLoadout);
        }
      }
      sequenceIndex = 0;
      startAutoMessages();
    }
    this.render();
  }
}
