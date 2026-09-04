const GAS_URL = 'https://script.google.com/macros/s/AKfycbypuLwClhYNsrR0fSp5tg0J8l1Yo0E3T3NQOrvziL3-IqUIZO4wmSucOoulQtTi6sY8/exec';

let currentChart = null;
let isChartView = false;

// Настройка цветов для темной темы Chart.js
Chart.defaults.color = '#e0e0e0';
Chart.defaults.borderColor = '#444444';

async function init() {
    try {
        const response = await fetch(`${GAS_URL}?action=getSheets`);
        const data = await response.json();
        
        const select = document.getElementById('sheet-select');
        data.sheets.forEach(sheetName => {
            const option = document.createElement('option');
            option.value = sheetName;
            option.innerText = sheetName;
            select.appendChild(option);
        });

        select.style.display = 'inline-block';
        document.getElementById('toggle-view-btn').style.display = 'inline-block';
        
        select.addEventListener('change', (e) => loadSheetData(e.target.value));

        if (data.sheets.length > 0) {
            loadSheetData(data.sheets[0]);
        } else {
            document.getElementById('loader').innerText = 'Немає доступних аркушів';
        }
    } catch (error) {
        document.getElementById('loader').innerText = 'Помилка завантаження списку вкладок';
        console.error('Ошибка инициализации:', error);
    }
}

async function loadSheetData(sheetName) {
    document.getElementById('loader').style.display = 'block';
    document.getElementById('tables-container').innerHTML = '';
    
    // Уничтожаем старый график при смене вкладки
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    try {
        const response = await fetch(`${GAS_URL}?sheet=${encodeURIComponent(sheetName)}`);
        const data = await response.json();
        
        document.getElementById('loader').style.display = 'none';
        
        const validRows = data.data.filter(row => row.join('').trim() !== '');
        if (validRows.length > 0) {
            renderTable(validRows);
            renderChart(validRows);
        }
    } catch (error) {
        document.getElementById('loader').innerText = 'Помилка завантаження даних';
        console.error('Ошибка при получении данных:', error);
    }
}

function renderTable(validRows) {
    const tablesContainer = document.getElementById('tables-container');
    const currentHour = new Date().getHours();

    const headerRows = validRows.slice(0, 2);
    const dataRows = validRows.slice(2);

    let hasZvidki = false;
    for (let i = 0; i < headerRows.length; i++) {
        if (headerRows[i].some(cell => cell.toString().toLowerCase().includes('звідки'))) {
            hasZvidki = true;
            break;
        }
    }

    let tableHTML = '<table>';

    headerRows.forEach(row => {
        tableHTML += '<tr>';
        row.forEach(cell => { tableHTML += `<th>${cell}</th>`; });
        tableHTML += '</tr>';
    });

    if (hasZvidki) {
        const groups = {};
        const order = [];
        let totalRow = null;

        dataRows.forEach(row => {
            const hour = row[0].toString().trim(); 
            if (!hour) return; 

            if (hour.toLowerCase().includes('всього')) {
                totalRow = row;
                return;
            }

            if (!groups[hour]) {
                groups[hour] = [];
                order.push(hour);
            }
            groups[hour].push(row);
        });

        order.forEach(hour => {
            const group = groups[hour];
            const isCurrentHour = (parseInt(hour, 10) === currentHour);
            const currentClass = isCurrentHour ? 'current-hour' : '';

            const summaryRow = new Array(group[0].length).fill(''); 
            
            for (let col = 0; col < summaryRow.length; col++) {
                if (col === 0) {
                    summaryRow[col] = `<span class="expand-icon">▶</span> ${hour}`;
                    continue;
                }

                let sum = 0;
                let hasNumbers = false;
                for (let r = 0; r < group.length; r++) {
                    const cellValue = group[r][col];
                    const valStr = cellValue ? cellValue.toString().replace(/\s/g, '').replace(',', '.').trim() : '';
                    const val = parseFloat(valStr);
                    
                    if (!isNaN(val) && valStr !== '') {
                        sum += val;
                        hasNumbers = true;
                    }
                }
                
                if (hasNumbers) {
                    summaryRow[col] = sum % 1 !== 0 ? sum.toFixed(2) : sum;
                }
            }

            tableHTML += `<tr class="summary-row ${currentClass}" data-hour="${hour}" onclick="toggleAccordion('${hour}')">`;
            summaryRow.forEach((cell, idx) => {
                tableHTML += `<td ${idx === 0 ? 'style="text-align: left;"' : ''}>${cell}</td>`;
            });
            tableHTML += '</tr>';

            group.forEach((row) => {
                tableHTML += `<tr class="detail-row detail-${hour} ${currentClass}">`;
                row.forEach(cell => { tableHTML += `<td>${cell}</td>`; });
                tableHTML += '</tr>';
            });
        });

        if (totalRow) {
            tableHTML += `<tr style="background-color: #2c2c2c; font-weight: bold; color: #ffffff;">`;
            totalRow.forEach(cell => { tableHTML += `<td>${cell}</td>`; });
            tableHTML += '</tr>';
        }

    } else {
        dataRows.forEach(row => {
            const rowHour = parseInt(row[0], 10);
            const currentClass = (!isNaN(rowHour) && rowHour === currentHour) ? 'class="current-hour"' : '';
            
            tableHTML += `<tr ${currentClass}>`;
            row.forEach(cell => { tableHTML += `<td>${cell}</td>`; });
            tableHTML += '</tr>';
        });
    }

    tableHTML += '</table>';
    tablesContainer.innerHTML = tableHTML;
}

function renderChart(validRows) {
    const headerRow = validRows[1]; // Берем последнюю строку шапки для названий колонок
    const dataRows = validRows.slice(2);

    // Находим индекс колонки "Звідки", чтобы её проигнорировать
    const zvidkiIndex = headerRow.findIndex(h => h.toString().toLowerCase().includes('звідки'));

    const hoursOrder = [];
    const chartDataMap = {};

    // 1. Агрегируем данные (суммируем по часам, как в таблице)
    dataRows.forEach(row => {
        const hour = row[0].toString().trim();
        if (!hour || hour.toLowerCase().includes('всього')) return;

        if (!chartDataMap[hour]) {
            chartDataMap[hour] = new Array(headerRow.length).fill(0);
            hoursOrder.push(hour);
        }

        for (let i = 1; i < row.length; i++) {
            if (i === zvidkiIndex) continue; // Игнорируем "Звідки"
            
            const cellValue = row[i];
            const valStr = cellValue ? cellValue.toString().replace(/\s/g, '').replace(',', '.').trim() : '';
            const val = parseFloat(valStr);
            
            if (!isNaN(val)) {
                chartDataMap[hour][i] += val;
            }
        }
    });

    // 2. Подготавливаем Датасеты (поля)
    const datasets = [];
    const colors = ['#90caf9', '#ffb74d', '#81c784', '#e57373', '#ba68c8', '#4dd0e1', '#aed581', '#f06292'];
    let colorIndex = 0;

    for (let i = 1; i < headerRow.length; i++) {
        if (i === zvidkiIndex) continue; // Не чертим график для "Звідки"

        const columnLabel = headerRow[i] ? headerRow[i].toString().trim() : `Поле ${i}`;
        const dataValues = hoursOrder.map(h => chartDataMap[h][i]);

        // Если в колонке вообще нет числовых данных, пропускаем её (не засоряем легенду)
        if (dataValues.every(v => v === 0)) continue;

        datasets.push({
            label: columnLabel,
            data: dataValues,
            backgroundColor: colors[colorIndex % colors.length],
            borderColor: colors[colorIndex % colors.length],
            borderWidth: 2,
            tension: 0.3 // Немного сглаживаем линии
        });
        colorIndex++;
    }

    // 3. Рисуем график
    const ctx = document.getElementById('myChart').getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'line', // Тип графика (линейный)
        data: {
            labels: hoursOrder, // По оси X идут часы
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { size: 14 } } // Кликабельная легенда работает по умолчанию
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return 'Година: ' + context[0].label;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Управление переключением График/Таблица
window.toggleView = function() {
    const btn = document.getElementById('toggle-view-btn');
    const tableDiv = document.getElementById('tables-container');
    const chartDiv = document.getElementById('chart-container');

    isChartView = !isChartView;

    if (isChartView) {
        tableDiv.style.display = 'none';
        chartDiv.style.display = 'block';
        btn.innerText = 'Показати таблицю';
        
        // Chart.js требует обновления размера при выходе из display: none
        if (currentChart) currentChart.resize(); 
    } else {
        tableDiv.style.display = 'block';
        chartDiv.style.display = 'none';
        btn.innerText = 'Показати графік';
    }
};

window.toggleAccordion = function(hour) {
    const rows = document.querySelectorAll(`.detail-${hour}`);
    const summaryRow = document.querySelector(`.summary-row[data-hour="${hour}"]`);

    if (!summaryRow) return;

    summaryRow.classList.toggle('expanded');
    const icon = summaryRow.querySelector('.expand-icon');
    
    if (summaryRow.classList.contains('expanded')) {
        icon.innerText = '▼';
    } else {
        icon.innerText = '▶';
    }

    rows.forEach(row => {
        row.classList.toggle('show');
    });
};

init();