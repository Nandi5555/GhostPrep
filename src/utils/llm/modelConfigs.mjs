const MODEL_CONFIGS = [
    {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        uiLabel: 'GPT-4o mini (fast + strong)',
        provider: 'openai',
        capabilities: { webSearch: true },
        requestDefaults: {
            textFormat: 'text',
            temperature: 1.0,
            topP: 1.0,
            maxOutputTokens: 2048,
            store: true,
        },
    },
    {
        id: 'gpt-4.1-mini',
        label: 'GPT-4.1 mini',
        uiLabel: 'GPT-4.1 mini (fast)',
        provider: 'openai',
        capabilities: { webSearch: true },
        requestDefaults: {
            textFormat: 'text',
            temperature: 1.0,
            topP: 1.0,
            maxOutputTokens: 2048,
            store: true,
        },
    },
];

function listModelConfigs({ provider } = {}) {
    const p = provider ? String(provider).trim().toLowerCase() : '';
    const list = Array.isArray(MODEL_CONFIGS) ? MODEL_CONFIGS : [];
    return p ? list.filter(m => String(m?.provider || '').toLowerCase() === p) : list.slice();
}

function getDefaultModelId({ provider = 'openai' } = {}) {
    const list = listModelConfigs({ provider });
    return list[0]?.id || 'gpt-4o-mini';
}

function normalizeModelId(modelId, { provider = 'openai' } = {}) {
    const raw = String(modelId || '').trim();
    if (!raw) return getDefaultModelId({ provider });
    const list = listModelConfigs({ provider });
    const hit = list.find(m => m.id === raw);
    return hit?.id || getDefaultModelId({ provider });
}

function getModelConfig(modelId, { provider = 'openai' } = {}) {
    const id = normalizeModelId(modelId, { provider });
    const list = listModelConfigs({ provider });
    const cfg = list.find(m => m.id === id) || list[0] || {};
    const defaults = cfg.requestDefaults && typeof cfg.requestDefaults === 'object' ? cfg.requestDefaults : {};
    const capabilities = cfg.capabilities && typeof cfg.capabilities === 'object' ? cfg.capabilities : {};
    return {
        id,
        label: String(cfg.label || id),
        uiLabel: String(cfg.uiLabel || cfg.label || id),
        provider: String(cfg.provider || provider),
        capabilities: { ...capabilities },
        requestDefaults: {
            textFormat: String(defaults.textFormat || 'text'),
            temperature: typeof defaults.temperature === 'number' ? defaults.temperature : 1.0,
            topP: typeof defaults.topP === 'number' ? defaults.topP : 1.0,
            maxOutputTokens: typeof defaults.maxOutputTokens === 'number' ? defaults.maxOutputTokens : 2048,
            store: typeof defaults.store === 'boolean' ? defaults.store : true,
            ...(defaults.reasoning && typeof defaults.reasoning === 'object' ? { reasoning: { ...defaults.reasoning } } : {}),
        },
    };
}

export { MODEL_CONFIGS, listModelConfigs, getModelConfig, normalizeModelId, getDefaultModelId };
