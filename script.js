// كائن لحفظ الرسوم البيانية حتى نتمكن من مسحها وتحديثها عند إدخال مسألة جديدة
let charts = {};

// دالة التنقل بين التبويبات (Tabs)
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// ==========================================
// 1. حساب ورسم نقطة التعادل (Break-Even)
// ==========================================
function drawBreakEven() {
    let cf = parseFloat(document.getElementById('be-cf').value);
    let cv = parseFloat(document.getElementById('be-cv').value);
    let p = parseFloat(document.getElementById('be-p').value);

    if (isNaN(cf) || isNaN(cv) || isNaN(p)) { 
        alert("يرجى إدخال أرقام صحيحة!"); 
        return; 
    }
    if (p <= cv) { 
        alert("تنبيه: سعر البيع يجب أن يكون أكبر من التكلفة المتغيرة لتحقيق تعادل!"); 
        return; 
    }

    let bev = cf / (p - cv);
    let totalRevenueAtBE = bev * p;

    document.getElementById('be-results').innerHTML = `
        <b>نتائج نقطة التعادل:</b><br>
        • <b>حجم كمية التعادل ($v$):</b> ${bev.toFixed(2)} وحدة.<br>
        • <b>قيمة الإيرادات والتكاليف عند التعادل:</b> $${totalRevenueAtBE.toFixed(2)}
    `;

    let maxV = Math.ceil(bev * 2);
    let step = Math.ceil(maxV / 5);
    let volumes = [];
    for (let v = 0; v <= maxV; v += step) { volumes.push(v); }
    if (!volumes.includes(Math.round(bev))) { volumes.push(Math.round(bev)); volumes.sort((a,b)=>a-b); }

    let fixedCosts = volumes.map(() => cf);
    let totalCosts = volumes.map(v => cf + (v * cv));
    let totalRevenues = volumes.map(v => v * p);

    renderChart('beChart', volumes, [
        { label: 'التكاليف الثابتة (FC)', data: fixedCosts, borderColor: 'gray', borderDash: [5,5] },
        { label: 'التكلفة الكلية (TC)', data: totalCosts, borderColor: 'red' },
        { label: 'الإيراد الكلي (TR)', data: totalRevenues, borderColor: 'green' }
    ], 'حجم المبيعات (Units)', 'المبلغ ($)');
}

// ==========================================
// 2. حساب ورسم البرمجة الخطية والحل البياني (LP Solver)
// ==========================================
function drawLP() {
    // أ. قراءة معامل دالة الهدف والنوع
    let c1 = parseFloat(document.getElementById('max-c1')?.value) || 120;
    let c2 = parseFloat(document.getElementById('max-c2')?.value) || 100;
    
    // ب. القيود المكتوبة في الكشكول
    let constraints = [
        { a: 10, b: 5, type: '<=', rhs: 80,  name: 'القيد 1 (10x1 + 5x2 <= 80)' },
        { a: 6,  b: 6, type: '<=', rhs: 66,  name: 'القيد 2 (6x1 + 6x2 <= 66)' },
        { a: 4,  b: 8, type: '>=', rhs: 24,  name: 'القيد 3 (4x1 + 8x2 >= 24)' },
        { a: 5,  b: 6, type: '<=', rhs: 90,  name: 'القيد 4 (5x1 + 6x2 <= 90)' }
    ];

    let candidatePoints = [];

    // إضافة نقطة الأصل (0,0)
    candidatePoints.push({ x1: 0, x2: 0 });

    // حساب تقاطع كل قيد مع المحورين
    constraints.forEach(c => {
        if (c.a !== 0) candidatePoints.push({ x1: c.rhs / c.a, x2: 0 });
        if (c.b !== 0) candidatePoints.push({ x1: 0, x2: c.rhs / c.b });
    });

    // حساب تقاطع كل خطين معاً
    for (let i = 0; i < constraints.length; i++) {
        for (let j = i + 1; j < constraints.length; j++) {
            let eq1 = constraints[i], eq2 = constraints[j];
            let det = (eq1.a * eq2.b) - (eq1.b * eq2.a);

            if (det !== 0) {
                let x1 = ((eq1.rhs * eq2.b) - (eq1.b * eq2.rhs)) / det;
                let x2 = ((eq1.a * eq2.rhs) - (eq1.rhs * eq2.a)) / det;
                if (x1 >= 0 && x2 >= 0) {
                    candidatePoints.push({ x1: x1, x2: x2 });
                }
            }
        }
    }

    // تصفية النقاط لتحقيق شرط عدم السلبية وجميع القيود معاً (Feasible Region Points)
    let feasiblePoints = candidatePoints.filter(p => {
        if (p.x1 < -0.001 || p.x2 < -0.001) return false;
        return constraints.every(c => {
            let val = (c.a * p.x1) + (c.b * p.x2);
            if (c.type === '<=') return val <= c.rhs + 0.001;
            if (c.type === '>=') return val >= c.rhs - 0.001;
            if (c.type === '=')  return Math.abs(val - c.rhs) < 0.001;
            return true;
        });
    });

    // إزالة النقاط المكررة
    let uniquePoints = [];
    feasiblePoints.forEach(p => {
        if (!uniquePoints.some(u => Math.abs(u.x1 - p.x1) < 0.01 && Math.abs(u.x2 - p.x2) < 0.01)) {
            uniquePoints.push({
                x1: Math.round(p.x1 * 100) / 100,
                x2: Math.round(p.x2 * 100) / 100,
                z: (c1 * p.x1) + (c2 * p.x2)
            });
        }
    });

    // ترتيب النقاط لإيجاد الحل الأمثل
    uniquePoints.sort((a, b) => b.z - a.z);
    let optimal = uniquePoints[0];

    // عرض مخرجات الحسابات في مربع النتائج
    let resultsHTML = `<b>نقاط الزوايا الممكنة (Extreme Points):</b><br>`;
    uniquePoints.forEach((p, idx) => {
        resultsHTML += `• Point ${String.fromCharCode(65 + idx)}: (${p.x1}, ${p.x2}) &rarr; Z = ${p.z}<br>`;
    });

    resultsHTML += `<br><b style="color: #276749; font-size: 16px; background-color: #c6f6d5; padding: 5px; border-radius: 4px; display: inline-block;">
        الحل الأمثل المحسوب (Optimal Solution):<br>
        x1* = ${optimal.x1}, &nbsp; x2* = ${optimal.x2} <br>
        Max Z* = ${optimal.z}
    </b>`;

    let resultsElement = document.getElementById('max-results');
    if (resultsElement) resultsElement.innerHTML = resultsHTML;

    // إعداد أجزاء الرسم البياني
    let maxX1 = 15;
    let xValues = [0, optimal.x1, maxX1];

    let datasets = constraints.map((c, idx) => {
        let colors = ['#3182ce', '#dd6b20', '#38a169', '#805ad5'];
        return {
            label: c.name,
            data: xValues.map(x1 => c.b !== 0 ? Math.max(0, (c.rhs - c.a * x1) / c.b) : 0),
            borderColor: colors[idx % colors.length],
            borderWidth: 2,
            fill: false
        };
    });

    renderChart('lpChart', xValues.map(x => x.toFixed(1)), datasets, 'المحور الأفقي (x1)', 'المحور الرأسي (x2)');
}

// ==========================================
// 3. دالة الرسم العامة مع مكتبة Chart.js
// ==========================================
function renderChart(canvasId, labels, datasets, xTitle, yTitle) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    let ctx = canvas.getContext('2d');
    if (charts[canvasId]) { charts[canvasId].destroy(); }

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: xTitle } },
                y: { title: { display: true, text: yTitle }, beginAtZero: true }
            }
        }
    });
}

// تشغيل تلقائي عند فتح الصفحة
window.onload = function() {
    drawBreakEven();
    drawLP();
};