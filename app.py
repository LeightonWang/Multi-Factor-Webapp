from flask import Flask, request, jsonify, render_template
from backend import multifactor_backend as mf
import pandas as pd

app = Flask(__name__)

# 默认路径配置
FACTOR_DIR = 'backend/fivefactor_daily.csv'
BASE_PATH = 'backend/his_sh1_201907-202406'
START_DATE = '20190701'
END_DATE = '20240630'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/run_model', methods=['POST'])
def run_model():
    data = request.json
    factors = data['factors']
    portfolio = data['portfolio']

    df_returns = mf.get_returns(BASE_PATH, START_DATE, END_DATE, portfolio)
    df_factors = mf.load_factors(FACTOR_DIR)

    df_returns['date'] = pd.to_datetime(df_returns['date'])
    df_factors.index = pd.to_datetime(df_factors.index)

    df = df_returns.merge(df_factors, left_on='date', right_index=True, how='left')

    # R2 柱状图数据
    comb_names, r2_scores = mf.estimate_R2_hist(df)

    # 预测 vs 实际
    dates, y_pred, y_true, model_results = mf.get_predict_curve(df, factors)

    # 模型拟合参数
    stats_data = {
        'r_squared': model_results.rsquared,
        'adj_r_squared': model_results.rsquared_adj,
        'f_statistic': model_results.fvalue,
        'p_value': model_results.f_pvalue,
        'num_observations': model_results.nobs
    }
    # 获取系数和对应的 p 值
    coef_data = []
    for i, factor in enumerate(factors):
        coef_data.append({
            'factor': factor,
            'coefficient': model_results.params[i+1],  # +1 因为第一个通常是截距
            'std_error': model_results.bse[i+1],
            'p_value': model_results.pvalues[i+1],
            't_statistic': model_results.tvalues[i+1]
        })
    stats_data['coefficients'] = coef_data

    # 散点图数据
    scatter_data = {}
    for factor in factors:
        x = df[factor].dropna()
        y = df['weighted_return'].dropna()
        x = x[y.index]
        y = y[x.index]
        scatter_data[factor] = {
            'x': (x * 1e4).tolist(),
            'y': (y * 1e4).tolist()
        }

    return jsonify({
        'r2_chart': {
            'factors': comb_names,
            'scores': r2_scores
        },
        'line_chart': {
            'dates': dates.dt.strftime('%Y-%m-%d').tolist(),
            'y_pred': y_pred.tolist(),
            'y_true': y_true.tolist()
        },
        'scatter': scatter_data,
        'stats_data': stats_data
    })

if __name__ == '__main__':
    app.run(debug=True)
