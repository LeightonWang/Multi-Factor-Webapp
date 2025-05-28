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
    dates, y_pred, y_true, _ = mf.get_predict_curve(df, factors)

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
        'scatter': scatter_data
    })

if __name__ == '__main__':
    app.run(debug=True)
