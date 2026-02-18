console.log("ABNO TEXT MODULE LOADED");

let intervalId = null;
let sequenceIndex = 0;
let activeRects = [];

/* ---------------------------- */
/* MESSAGE QUEUE                */
/* ---------------------------- */
let messageQueue = [];
let isProcessingQueue = false;

function enqueueMessage(text) {
  messageQueue.push(text);
  if (!isProcessingQueue) processQueue();
}

function processQueue() {
  if (messageQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }
  isProcessingQueue = true;
  const text = messageQueue.shift();
  const config = game.settings.get("abno-text", "config");
  const totalDuration = config.duration + config.fadeOutTime;

  showAbnoMessage(text);
  setTimeout(processQueue, totalDuration);
}

/* ---------------------------- */
/* SETTINGS                     */
/* ---------------------------- */
Hooks.once("init", () => {
  game.settings.register("abno-text", "config", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      messages: ["Default text...", "Default second line of text.", "Third line of default text."],
      duration: 2000,
      fadeOutTime: 500,
      frequency: 5,
      fontSize: 25,
      color: "#ff3333",
      fontFamily: "serif",
      typingSpeed: 75,
      randomMode: false,
      randomAngle: true,
      maxAngle: 30,
      autoScaleLongText: true,
      maxSimultaneous: 3,
      outlineEnabled: true,
      outlineColor: "#000000",
      outlineThickness: 2,
      shakeyText: false,
      shakeIntensity: 0
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
  
  // Register Handlebars helper for comparison
  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  // ----------------------------
  // SOCKET COMMUNICATION SETUP
  // ----------------------------
  // Players receive broadcasted messages from GM via socket
  game.socket.on("module.abno-text", (data) => {
    if (data.message) {
      enqueueMessage(data.message);
    }
  });
  
  console.log("ABNO: Socket communication setup complete");
});


/* ---------------------------- */
/* READY                        */
/* ---------------------------- */
Hooks.once("ready", () => {
  if (game.user.isGM && game.settings.get("abno-text", "enabled")) {
    startAutoMessages();
    console.log("ABNO: Module ready, GM mode enabled =", game.settings.get("abno-text", "enabled"));
  } else if (!game.user.isGM) {
    console.log("ABNO: Module ready, non-GM user - auto-messages disabled");
  } else {
    console.log("ABNO: Module ready, enabled =", game.settings.get("abno-text", "enabled"));
  }
});


/* ---------------------------- */
/* SCENE CONTROLS               */
/* Compatible with v11 and v13  */
/* ---------------------------- */
Hooks.on("getSceneControlButtons", (controls) => {
  console.log("ABNO: getSceneControlButtons hook fired");

  if (!game.user.isGM) {
    console.log("ABNO: User is not GM, skipping");
    return;
  }

  const isV11 = Array.isArray(controls);

  const toolToggle = {
    name: "toggle",
    title: game.settings.get("abno-text", "enabled") ? "Disable Abno-Text" : "Enable Abno-Text",
    icon: "fas fa-power-off",
    toggle: true,
    active: game.settings.get("abno-text", "enabled"),
    onClick: async () => {
      const currentState = game.settings.get("abno-text", "enabled");
      const newState = !currentState;
      console.log("ABNO: Toggle clicked, changing from", currentState, "to", newState);
      await game.settings.set("abno-text", "enabled", newState);
      if (!newState && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("ABNO: Auto messages stopped");
      }
      if (newState) {
        startAutoMessages();
        console.log("ABNO: Auto messages started");
      }
      ui.controls.render();
      ui.notifications.info(`Abno-Text ${newState ? "Enabled" : "Disabled"}`);
    }
  };

  const toolLoadouts = {
    name: "loadouts",
    title: "Open Abno-Text Loadouts",
    icon: "fas fa-scroll",
    button: true,
    onClick: () => {
      console.log("ABNO: Loadouts button clicked");
      new AbnoLoadoutMenu().render(true);
    }
  };

  const toolConfig = {
    name: "config",
    title: "Open Abno-Text Configuration",
    icon: "fas fa-cog",
    button: true,
    onClick: () => {
      console.log("ABNO: Config button clicked");
      new AbnoTextConfig().render(true);
    }
  };

  if (isV11) {
    controls.push({
      name: "abnoText",
      title: "Abno Text",
      icon: "fas fa-comment",
      visible: true,
      layer: "controls",
      activeTool: "select",
      tools: [
        { name: "select", title: "Abno Text Controls", icon: "fas fa-comment" },
        toolToggle,
        toolLoadouts,
        toolConfig
      ]
    });
  } else {
    controls.abnoText = {
      name: "abnoText",
      title: "Abno Text",
      icon: "fas fa-comment",
      visible: true,
      layer: "controls",
      activeTool: "select",
      tools: {
        select: { name: "select", title: "Abno Text Controls", icon: "fas fa-comment" },
        toggle: toolToggle,
        loadouts: toolLoadouts,
        config: toolConfig
      }
    };
  }

  console.log("ABNO: Control group added successfully (v11 mode:", isV11, ")");
});


/* ---------------------------- */
/* MESSAGE FUNCTIONS             */
/* ---------------------------- */
function getNextMessage() {
  const config = game.settings.get("abno-text", "config");
  if (!config.messages.length) return null;
  if (config.randomMode) return config.messages[Math.floor(Math.random() * config.messages.length)];
  
  const index = sequenceIndex;
  const msg = config.messages[index];
  sequenceIndex = (sequenceIndex + 1) % config.messages.length;
  
  console.log("ABNO: getNextMessage called, returning index", index, "=", msg);
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

  // Start shaking immediately when typing begins (if enabled)
  let stopShake = null;
  if (config.shakeyText) {
    stopShake = startShake(textElement[0], rotationDeg, config.shakeIntensity);
  }

  let i = 0;
  const typingInterval = setInterval(() => {
    textElement.text(text.slice(0, i));
    i++;
    if (i > text.length) {
      clearInterval(typingInterval);
      startLifetimeTimer(overlay, placedRect, config, stopShake);
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

function startLifetimeTimer(overlay, rect, config, stopShake = null) {
  setTimeout(() => {
    if (stopShake) stopShake();
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

/* ---------------------------- */
/* SHAKY TEXT                   */
/* ---------------------------- */
function startShake(element, rotationDeg, intensity) {
  let rafId = null;

  // Scale intensity exponentially so higher values feel dramatically more violent
  const t = intensity / 10;
  const scaledTranslate = 2 + (t * t) * 60;   // range: ~2px at 1, up to 62px at 10
  const scaledRotate    = 0.2 + (t * t) * 20;  // range: ~0.2deg at 1, up to 20deg at 10

  function shake() {
    const dx = (Math.random() - 0.5) * scaledTranslate * 2;
    const dy = (Math.random() - 0.5) * scaledTranslate * 2;
    const dr = (Math.random() - 0.5) * scaledRotate * 2;
    element.style.transform = `rotate(${rotationDeg + dr}deg) translate(${dx}px, ${dy}px)`;
    rafId = requestAnimationFrame(shake);
  }

  rafId = requestAnimationFrame(shake);

  return function stopShake() {
    if (rafId) cancelAnimationFrame(rafId);
    element.style.transform = `rotate(${rotationDeg}deg)`;
  };
}

function playNextMessage() {
  const msg = getNextMessage();
  if (msg) {
    if (game.user.isGM) {
      // Show locally for GM via queue
      enqueueMessage(msg);
      // Broadcast to players (they also use enqueueMessage via socket handler)
      game.socket.emit("module.abno-text", { message: msg });
      console.log("ABNO: Broadcasted message to all clients:", msg);
    }
  }
}

function startAutoMessages() {
  if (!game.settings.get("abno-text", "enabled") && game.user.isGM) return;
  const config = game.settings.get("abno-text", "config");
  if (intervalId) clearInterval(intervalId);
  if (config.frequency > 0) {
    intervalId = setInterval(playNextMessage, config.frequency * 1000);
    console.log("ABNO: Auto messages interval set to", config.frequency, "seconds");
  }
}


/* ---------------------------- */
/* CONFIG FORM                  */
/* ---------------------------- */
class AbnoTextConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, { 
      id: "abno-text-config", 
      title: "Abno-Text Configuration", 
      template: "modules/abno-text/templates/settings.html", 
      width: 650,
      height: "auto",
      closeOnSubmit: true,
      submitOnChange: false
    });
  }
  
  getData() { 
    return game.settings.get("abno-text", "config"); 
  }
  
  async _updateObject(event, formData) {
    console.log("ABNO: Saving config", formData);
    const data = foundry.utils.expandObject(formData);
    data.messages = data.messages.split("\n").map(m => m.trim()).filter(m => m.length > 0);
    data.randomMode = !!formData.randomMode;
    data.randomAngle = !!formData.randomAngle;
    data.autoScaleLongText = !!formData.autoScaleLongText;
    data.outlineEnabled = !!formData.outlineEnabled;
    data.shakeyText = !!formData.shakeyText;
    
    await game.settings.set("abno-text", "config", data);
    sequenceIndex = 0;
    // Reset queue when config changes
    messageQueue = [];
    isProcessingQueue = false;
    startAutoMessages();
    
    ui.notifications.info("Abno-Text configuration saved!");
    console.log("ABNO: Config saved successfully");
  }
}

/* ---------------------------- */
/* LOADOUT MENU                 */
/* ---------------------------- */
class AbnoLoadoutMenu extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, { 
      id: "abno-loadout-menu", 
      title: "Abno-Text Loadouts", 
      template: "modules/abno-text/templates/loadouts.html", 
      width: 500,
      height: "auto",
      closeOnSubmit: false,
      submitOnChange: false
    });
  }
  
  getData() {
    const loadouts = game.settings.get("abno-text", "loadouts");
    const activeLoadout = game.settings.get("abno-text", "activeLoadout");
    
    if (!loadouts.custom) {
      loadouts.custom = {};
    }
    
    console.log("ABNO Loadouts getData:");
    console.log("  - Full loadouts object:", loadouts);
    console.log("  - Custom loadouts:", loadouts.custom);
    console.log("  - Number of custom loadouts:", Object.keys(loadouts.custom).length);
    console.log("  - Custom loadout names:", Object.keys(loadouts.custom));
    console.log("  - Active loadout:", activeLoadout);
    
    return { 
      loadouts: loadouts, 
      activeLoadout: activeLoadout 
    };
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    const currentConfig = game.settings.get("abno-text", "config");
    
    // SAVE button
    html.find("#save-loadout-btn").on("click", async (event) => {
      event.preventDefault();
      const name = html.find("#loadout-name-input").val().trim();
      console.log("ABNO: Save button clicked, name:", name);
      
      if (name && name.length > 0) {
        const loadouts = foundry.utils.duplicate(game.settings.get("abno-text", "loadouts"));
        loadouts.custom[name] = foundry.utils.duplicate(currentConfig);
        
        await game.settings.set("abno-text", "loadouts", loadouts);
        ui.notifications.info(`Loadout "${name}" saved!`);
        console.log("ABNO: Loadout saved successfully");
        
        html.find("#loadout-name-input").val("");
        this.render();
      } else {
        ui.notifications.warn("Please enter a loadout name");
      }
    });
    
    // LOAD buttons
    html.find(".loadout-load-btn").on("click", async (event) => {
      event.preventDefault();
      const name = $(event.currentTarget).data("loadout");
      console.log("ABNO: Load button clicked for:", name);
      
      const loadouts = game.settings.get("abno-text", "loadouts");
      const selected = loadouts.custom[name];
      
      if (selected) {
        await game.settings.set("abno-text", "config", foundry.utils.duplicate(selected));
        await game.settings.set("abno-text", "activeLoadout", name);
        sequenceIndex = 0;
        // Reset queue on loadout change
        messageQueue = [];
        isProcessingQueue = false;
        startAutoMessages();
        ui.notifications.info(`Loadout "${name}" activated!`);
        console.log("ABNO: Loadout activated successfully");
        
        this.render();
      } else {
        ui.notifications.error(`Loadout "${name}" not found`);
      }
    });
    
    // DELETE buttons
    html.find(".loadout-delete-btn").on("click", async (event) => {
      event.preventDefault();
      const name = $(event.currentTarget).data("loadout");
      console.log("ABNO: Delete button clicked for:", name);
      
      const loadouts = foundry.utils.duplicate(game.settings.get("abno-text", "loadouts"));
      delete loadouts.custom[name];
      
      await game.settings.set("abno-text", "loadouts", loadouts);
      
      if (game.settings.get("abno-text", "activeLoadout") === name) {
        await game.settings.set("abno-text", "activeLoadout", "default");
      }
      
      ui.notifications.info(`Loadout "${name}" deleted`);
      console.log("ABNO: Loadout deleted successfully");
      
      this.render();
    });
    
    // RESTORE DEFAULT button
    html.find("#restore-default-btn").on("click", async (event) => {
      event.preventDefault();
      console.log("ABNO: Restore default button clicked");
      
      await game.settings.set("abno-text", "activeLoadout", "default");
      ui.notifications.info("Default configuration activated");
      console.log("ABNO: Default loadout activated");
      
      this.render();
    });
  }
}