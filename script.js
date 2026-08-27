// URL твоего опубликованного скрипта Apps Script
const GAS_URL = 'https://script.google.com/macros/s/AKfycbypuLwClhYNsrR0fSp5tg0J8l1Yo0E3T3NQOrvziL3-IqUIZO4wmSucOoulQtTi6sY8/exec';

async function init() {
    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        
        document.getElementById('loader').style.display = 'none';
        renderDashboard(data);
    } catch (error) {
        document.getElementById('loader').innerText = 'Ошибка загрузки данных. Проверьте консоль.';
        console.error('Ошибка при получении данных:', error);
    }
}

function renderDashboard(data) {
    const tabsContainer = document.getElementById('tabs-container');
    const tablesContainer = document.getElementById('tables-container');
    let isFirst = true;

    // Получаем текущий час (от 0 до 23)
    const currentHour = new Date().getHours();

    // Проходимся по каждому листу в полученном JSON
    for (const [sheetName, sheetData] of Object.entries(data)) {
        
        // 1. Создаем кнопку вкладки
        const btn = document.createElement('button');
        btn.className = `tab-btn ${isFirst ? 'active' : ''}`;
        btn.innerText = sheetName;
        btn.onclick = () => openTab(sheetName);
        tabsContainer.appendChild(btn);

        // 2. Создаем контейнер для таблицы
        const contentDiv = document.createElement('div');
        contentDiv.id = `tab-${sheetName}`;
        contentDiv.className = `tab-content ${isFirst ? 'active' : ''}`;

        // 3. Собираем HTML-таблицу
        let tableHTML = '<table>';
        sheetData.forEach((row, rowIndex) => {
            // Игнорируем полностью пустые строки
            if (row.join('') === '') return; 
            
            // Проверяем, совпадает ли первый столбец с текущим часом
            let rowClass = '';
            // Пропускаем первые 3 строки (заголовки)
            if (rowIndex >= 3) { 
                const rowHour = parseInt(row[0], 10);
                // Если значение в первой колонке — это число и оно равно текущему часу
                if (!isNaN(rowHour) && rowHour === currentHour) {
                    rowClass = 'class="current-hour"';
                }
            }
            
            tableHTML += `<tr ${rowClass}>`;
            row.forEach(cell => {
                const tag = rowIndex < 3 ? 'th' : 'td';
                tableHTML += `<${tag}>${cell}</${tag}>`;
            });
            tableHTML += '</tr>';
        });
        tableHTML += '</table>';

        contentDiv.innerHTML = tableHTML;
        tablesContainer.appendChild(contentDiv);

        isFirst = false;
    }
}

function openTab(targetSheetName) {
    // Убираем класс active у всех кнопок и таблиц
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Добавляем класс active кликнутой кнопке и её таблице
    const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.innerText === targetSheetName);
    const targetContent = document.getElementById(`tab-${targetSheetName}`);
    
    if (targetBtn) targetBtn.classList.add('active');
    if (targetContent) targetContent.classList.add('active');
}

// Запускаем инициализацию при загрузке скрипта
init();