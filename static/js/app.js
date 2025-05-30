
// 表格
document.addEventListener("DOMContentLoaded", function() {
    // 获取DOM元素
    const addStockBtn = document.getElementById("add-stock-btn");
    const portfolioTableBody = document.getElementById("portfolio-table-body");
    const portfolioInput = document.getElementById("portfolio");
    const totalWeightEl = document.getElementById("total-weight");
    
    // 全局存储股票数据
    window.allStocks = [];

    // 添加股票行
    addStockBtn.addEventListener("click", function() {
        addStockRow();
        updatePortfolioJSON();
    });

    // 添加股票行函数
    function addStockRow(stockCode = "", weight = "") {
        const row = document.createElement("tr");
        
        // 生成唯一ID用于datalist
        const dataListId = `stock-list-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        row.innerHTML = `
            <td>
                <div class="stock-select-container">
                    <input type="text" class="form-control stock-input" 
                           placeholder="输入或选择股票代码" 
                           list="${dataListId}" 
                           value="${stockCode}">
                    <datalist id="${dataListId}" class="stock-datalist"></datalist>
                </div>
            </td>
            <td>
                <input type="number" class="form-control stock-weight" value="${weight}" 
                    placeholder="例如: 0.5" step="0.01" min="0" max="1">
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-danger delete-stock">
                    <i class="bi bi-x"></i>
                </button>
            </td>
        `;
        
        // 填充datalist选项
        const datalist = row.querySelector(`#${dataListId}`);
        if (window.allStocks && window.allStocks.length > 0) {
            populateDatalist(datalist);
        }
        
        // 添加删除按钮事件监听器
        const deleteBtn = row.querySelector(".delete-stock");
        deleteBtn.addEventListener("click", function() {
            row.remove();
            updatePortfolioJSON();
        });
        
        // 权重输入事件
        const weightInput = row.querySelector(".stock-weight");
        weightInput.addEventListener("change", updatePortfolioJSON);
        weightInput.addEventListener("input", updatePortfolioJSON);
        
        portfolioTableBody.appendChild(row);
    }
    
    // 向datalist填充股票选项
    function populateDatalist(datalist) {
        // 清空现有选项
        datalist.innerHTML = '';
        
        // 添加股票选项
        window.allStocks.forEach(stock => {
            const option = document.createElement('option');
            option.value = stock.code;
            datalist.appendChild(option);
        });
    }
    
    // 更新隐藏的JSON输入
    function updatePortfolioJSON() {
        const rows = portfolioTableBody.querySelectorAll("tr");
        const portfolio = {};
        let totalWeight = 0;
        
        rows.forEach(row => {
            const stockInput = row.querySelector(".stock-input");
            const code = stockInput ? stockInput.value.trim() : "";
            const weightInput = row.querySelector(".stock-weight");
            const weight = parseFloat(weightInput.value) || 0;
            
            if (code && weight > 0) {
                portfolio[code] = weight;
                totalWeight += weight;
            }
        });
        
        // 更新隐藏字段
        portfolioInput.value = JSON.stringify(portfolio);
        
        // 更新总权重显示
        totalWeightEl.textContent = totalWeight.toFixed(2);
        
        // 根据总权重设置样式
        if (Math.abs(totalWeight - 1.0) < 0.001) {
            totalWeightEl.className = "text-success fw-bold";
        } else {
            totalWeightEl.className = "text-danger fw-bold";
        }
    }
    
    // 加载股票数据
    function loadStockListData() {
        return axios.get("/static/data/stocks.json")
            .then(response => {
                window.allStocks = response.data;
                
                // 初始化已有的股票选择框
                document.querySelectorAll('.stock-datalist').forEach(datalist => {
                    populateDatalist(datalist);
                });
                
                return window.allStocks;
            })
            .catch(error => {
                console.error("加载股票数据失败:", error);
                return [];
            });
    }

    // 预设股票组合
    function initPortfolioPresetSelector() {
        const presetSelector = document.getElementById("portfolio-preset-selector");
        if (!presetSelector) return;

        const presets = {
            "组合A": {
                "000001": 0.4,
                "600519": 0.3,
                "600036": 0.3
            },
            "组合B": {
                "000031": 0.5,
                "000078": 0.3,
                "000111": 0.2
            },
            "组合C": {
                "000002": 0.33,
                "600000": 0.33,
                "600104": 0.34
            }
        };

        for (const name in presets) {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            presetSelector.appendChild(option);
        }

        presetSelector.addEventListener("change", function () {
            const selected = presetSelector.value;
            if (presets[selected]) {
                portfolioTableBody.innerHTML = "";
                const stocks = presets[selected];
                for (const code in stocks) {
                    addStockRow(code, stocks[code]);
                }
                updatePortfolioJSON();
            }
        });
    }
    
    // 初始化
    loadStockListData().then(() => {
        // 如果表格为空，添加默认行
        if (portfolioTableBody.children.length === 0) {
            addStockRow("000002", 0.5);
            addStockRow("600000", 0.3);
            addStockRow("600096", 0.2);
            updatePortfolioJSON();
        }

        // 预设组合
        initPortfolioPresetSelector();
    });
});

document.getElementById("input-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const factors = Array.from(document.querySelectorAll('input[name="factor"]:checked')).map(el => el.value);
    const portfolio = JSON.parse(document.getElementById("portfolio").value);

    if (factors.length === 0) {
        alert("请至少选择一个因子");
        return;
    }
    
    if (Object.keys(portfolio).length === 0) {
        alert("请添加至少一支股票到投资组合中");
        return;
    }
    
    // 检查权重总和
    const totalWeight = Object.values(portfolio).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
        if (!confirm(`投资组合权重总和为 ${totalWeight.toFixed(2)}，不等于1.0。是否继续？`)) {
            return;
        }
    }

    // 进度条，且加载时不可再次提交
    document.getElementById("loading-container").style.display = "block";
    document.querySelector("button[type='submit']").disabled = true;

    try {
        const response = await axios.post("/run_model", {
            factors: factors,
            portfolio: portfolio
        });

        const data = response.data;

        displayModelStats(data.stats_data);

        // R2 Bar Chart
        const charts_container = document.getElementById('charts-container');
        charts_container.style.display = 'block';
        charts_container.classList.add('hidden-chart');
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
                itemStyle: { color: '#5b9bd5' },
                animationDelay: function (idx) {
                    return idx * 300;
                },
                animationDuration: 2500,
                animationEasing: 'elasticOut'
            }]
        });

        // 添加滚动监测
        const observeCharts = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('show-chart');
                    r2_chart.dispatchAction({
                        type: 'highlight',
                        seriesIndex: 0
                    });
                    setTimeout(() => {
                        r2_chart.dispatchAction({
                            type: 'downplay',
                            seriesIndex: 0
                        });
                    }, 1500);
                    observeCharts.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        observeCharts.observe(charts_container);

        // Line Chart
        const line_chart_container = document.getElementById('line-container');
        line_chart_container.style.display = 'block';
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
        const scatter_container = document.getElementById('scatter-container');
        scatter_container.style.display = 'block';
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
    } catch (error) {
        console.error("Error fetching model data:", error);
        alert("模型运行失败，请检查输入数据或稍后再试。");
    } finally {
        // 隐藏进度条，恢复提交按钮
        document.getElementById("loading-container").style.display = "none";
        document.querySelector("button[type='submit']").disabled = false;
    }
});

function displayModelStats(stats_data) {
    // 显示容器
    const container = document.getElementById('model-stats-container');
    container.style.display = 'block';

    // 填充主要统计数据
    const statsBody = document.getElementById('model-stats-body');
    statsBody.innerHTML = '';

    const mainStats = [
        { name: 'R²', value: stats_data.r_squared.toFixed(4) },
        { name: '调整后 R²', value: stats_data.adj_r_squared.toFixed(4) },
        { name: 'F 统计量', value: stats_data.f_statistic.toFixed(4) },
        { name: 'p 值', value: stats_data.p_value < 0.0001 ? '< 0.0001' : stats_data.p_value.toExponential(4) },
        { name: '观测数', value: stats_data.num_observations }
    ];

    mainStats.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.name}</td><td>${item.value}</td>`;
        statsBody.appendChild(row);
    });

    // 填充系数数据
    const coeffBody = document.getElementById('coefficients-body');
    coeffBody.innerHTML = '';

    // 添加所有因子系数
    stats_data.coefficients.forEach(coef => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${coef.factor}</td>
            <td>${coef.coefficient.toFixed(6)}</td>
            <td>${coef.std_error.toFixed(6)}</td>
            <td>${coef.t_statistic.toFixed(4)}</td>
            <td>${coef.p_value < 0.0001 ? '< 0.0001' : coef.p_value.toExponential(4)}</td>
        `;
        coeffBody.appendChild(row);
    });
}
