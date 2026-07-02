const supabase = require('../supabase');

async function getSession(phone) {
    const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

    if (error) {
        console.error('Error fetching whatsapp session:', error.message);
        return { data: null, error };
    }
    return { data, error: null };
}

async function saveSession(phone, updates) {
    const { error } = await supabase
        .from('whatsapp_sessions')
        .upsert({ phone, ...updates }, { onConflict: 'phone' });

    if (error) {
        console.error('Error saving whatsapp session:', error.message);
    }
    return { error };
}

async function clearSession(phone) {
    const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('phone', phone);

    if (error) {
        console.error('Error clearing whatsapp session:', error.message);
    }
}

function toLocalPhone(whatsappFrom) {
    return '0' + whatsappFrom.replace('whatsapp:+254', '');
}

function toWhatsAppPhone(localOr254Phone) {
    const digits = localOr254Phone.replace(/\D/g, '');
    const normalized = digits.startsWith('254') ? digits : '254' + digits.slice(1);
    return `whatsapp:+${normalized}`;
}

module.exports = {
    getSession,
    saveSession,
    clearSession,
    toLocalPhone,
    toWhatsAppPhone,
};
