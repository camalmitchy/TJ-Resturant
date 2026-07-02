const MENU_CATEGORIES = [
    {
        name: 'Morning Selections',
        items: [
            { name: 'Milk Tea', price: 30 },
            { name: 'Soft Mandazi (per piece)', price: 10 },
            { name: 'Farm Fresh Eggs (2 pieces)', price: 70 },
            { name: 'Hand-Rolled Chapati', price: 20 },
        ],
    },
    {
        name: 'Light Bites & Snacks',
        items: [
            { name: 'Golden Crispy Chips', price: 120 },
            { name: 'Premium Smokies', price: 40 },
            { name: 'Samosa', price: 40 },
            { name: 'Sausage', price: 50 },
        ],
    },
    {
        name: 'Chapati Pairings',
        items: [
            { name: 'Chapati with Beans', price: 100 },
            { name: 'Chapati with Ndengu', price: 100 },
            { name: 'Chapati with Green Peas (Minji)', price: 120 },
            { name: 'Chapati with Njahi', price: 120 },
        ],
    },
    {
        name: 'Ugali Specialties',
        items: [
            { name: 'Ugali Plain', price: 40 },
            { name: 'Ugali with Sukuma Wiki', price: 100 },
            { name: 'Ugali with Omena', price: 120 },
            { name: 'Ugali with Tender Beef', price: 150 },
        ],
    },
    {
        name: 'Rice Collection',
        items: [
            { name: 'Plain Steamed Rice', price: 60 },
            { name: 'Rice with Seasonal Vegetables', price: 100 },
            { name: 'Rice with Githeri', price: 130 },
            { name: 'Rice with Beans', price: 130 },
            { name: 'Rice with Ndengu', price: 120 },
            { name: 'Rice with Green Peas (Minji)', price: 140 },
            { name: 'Rice with Njahi', price: 140 },
            { name: 'Rice with Succulent Beef', price: 200 },
        ],
    },
    {
        name: 'Traditional Sides (Plain)',
        items: [
            { name: 'Beans', price: 50 },
            { name: 'Githeri', price: 100 },
            { name: 'Omena', price: 80 },
            { name: 'Njahi', price: 80 },
            { name: 'Green Peas (Minji)', price: 80 },
            { name: 'Beef', price: 140 },
        ],
    },
];

const MENU = MENU_CATEGORIES.reduce((items, category) => {
    category.items.forEach(item => {
        items.push({
            id: items.length + 1,
            name: item.name,
            price: item.price,
            category: category.name,
        });
    });
    return items;
}, []);

function findMenuItem(id) {
    return MENU.find(item => item.id === id);
}

function buildMenuText() {
    const lines = [];
    let itemNumber = 1;

    for (const category of MENU_CATEGORIES) {
        lines.push(`*${category.name}*`);
        for (const item of category.items) {
            lines.push(`${itemNumber}. ${item.name} — KSh ${item.price}`);
            itemNumber += 1;
        }
        lines.push('');
    }

    return lines.join('\n').trim();
}

module.exports = {
    MENU,
    MENU_CATEGORIES,
    findMenuItem,
    buildMenuText,
};
