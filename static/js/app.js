
document.getElementById("input-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const factors = Array.from(document.querySelectorAll('input[name="factor"]:checked')).map(el => el.value);
    const portfolio = JSON.parse(document.getElementById("portfolio").value);

    const response = await axios.post("/run_model", {
        factors: factors,
        portfolio: portfolio
    });

    const data = response.data;

    // R2 Bar Chart
    const r2_chart = echarts.init(document.getElementById('r2_chart'));
    r2_chart.setOption({
        tooltip: {},
        xAxis: {
            type: 'category',
            data: data.r2_chart.factors
        },
        yAxis: {
            type: 'value',
            max: 1
        },
        series: [{
            type: 'bar',
            data: data.r2_chart.scores,
            itemStyle: { color: '#5b9bd5' }
        }]
    });

    // Line Chart
    const line_chart = echarts.init(document.getElementById('line_chart'));
    const ma = (arr, window) => arr.map((v, i, a) =>
        i < window ? null : a.slice(i - window, i).reduce((s, x) => s + x, 0) / window
    );
    const ma_true = ma(data.line_chart.y_true, 5);
    const ma_pred = ma(data.line_chart.y_pred, 5);
    line_chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['真实', '预测', '真实(滑动平均)', '预测(滑动平均)'] },
        xAxis: { type: 'category', data: data.line_chart.dates },
        yAxis: { type: 'value' },
        series: [
            { name: '真实', type: 'line', data: data.line_chart.y_true },
            { name: '预测', type: 'line', data: data.line_chart.y_pred },
            { name: '真实(滑动平均)', type: 'line', data: ma_true, smooth: true },
            { name: '预测(滑动平均)', type: 'line', data: ma_pred, smooth: true }
        ]
    });

    // Scatter Charts
    const scatter_div = document.getElementById('scatter_charts');
    scatter_div.innerHTML = '';
    for (const [factor, scatter] of Object.entries(data.scatter)) {
        const chartId = 'scatter_' + factor;
        const colDiv = document.createElement('div');
        colDiv.className = 'col-md-6 mb-3';
        colDiv.innerHTML = `<h6>${factor}</h6><div id="${chartId}" style="height: 300px;"></div>`;
        scatter_div.appendChild(colDiv);

        const chart = echarts.init(document.getElementById(chartId));
        chart.setOption({
            tooltip: {},
            xAxis: { type: 'value', name: factor },
            yAxis: { type: 'value', name: '超额收益' },
            series: [{
                type: 'scatter',
                data: scatter.x.map((x, i) => [x, scatter.y[i]]),
                symbolSize: 4,
                itemStyle: { color: '#d94e5d' }
            }]
        });
    }
});
