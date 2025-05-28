"""
Multifactor Analysis Backend Script

This script provides functionality to:
1. Load factor data from CSV files
2. Compute multifactor scores from daily stock data
3. Run regressions using statsmodels

Author: Converted from Jupyter Notebook
"""

import os
import pandas as pd
import numpy as np
import statsmodels.api as sm
from tqdm import tqdm
import matplotlib.pyplot as plt
import functools
from sklearn.linear_model import LinearRegression
import matplotlib.ticker as mtick
from typing import List

def load_factors(factor_dir):
    """
    Load factor data from CSV files in the specified directory.

    Args:
        factor_dir (str): Directory containing factor CSV files.

    Returns:
        factors_df (pd.DataFrame): DataFrame containing all factors.
    """
    factors_d = pd.read_csv(factor_dir, index_col=0, parse_dates=True)
    return factors_d

def get_returns(base_path, start_date, end_date, stock_list):
    """
    获取ETF的收益率数据

    Parameters
    ----------
    base_path : str
        数据存放的路径
    start_date : str
        开始日期
    end_date : str  
        结束日期
    stock_list : dict[str, float]
        股票列表，key为股票代码，value为权重

    Return:
    -------
    pd.DataFrame
        包含日期和加权收益率的DataFrame
    """
    all_data = []
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')

    for date in tqdm(date_range):
        date_str = date.strftime('%Y%m%d')
        file_path = os.path.join(base_path, date_str, 'Day.csv')

        try:
            df_day = pd.read_csv(file_path, header=None, skiprows=1, dtype={0: str})
            df_day = df_day.iloc[:, :9]
            df_day.columns = ['code', 'date', 'prev_close', 'open', 'high', 'low', 'close', 'volume', 'amount']

            # 按照 code 读取股票数据
            stock_data = df_day[df_day['code'].isin(stock_list.keys())].copy()
            # print(stock_data['code'])

            if not stock_data.empty:
                stock_data['weight'] = stock_data['code'].map(stock_list)
                
                all_data.append({
                    'date': date_str,
                    'weighted_return': np.sum(stock_data['weight'] * (stock_data['close'] / stock_data['prev_close'] - 1))
                })

        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"Error processing file {file_path}: {e}")

    df = pd.DataFrame(all_data)
    return df

def regression(X, y):
    """
    Perform regression analysis using statsmodels.

    Args:
        X (pd.DataFrame): Independent variables (factors).
        y (pd.Series): Dependent variable (returns).

    Returns:
        results (statsmodels.regression.linear_model.RegressionResultsWrapper): Regression results.
    """
    X = sm.add_constant(X)
    model = sm.OLS(y, X)
    results = model.fit()
    return results

# @functools.lru_cache(maxsize=128, typed=False)
def estimate_R2_hist(df):
    # ret_actual = get_actual_returns(pname, daterange)
    _factors, _scores = [], []
    factor_scenarios = ['mkt_rf', 'smb', 'hml', 'rmw', 'cma', 
                        'mkt_rf+smb', 'mkt_rf+hml', 'mkt_rf+smb+hml', 
                        'mkt_rf+smb+hml+rmw', 'mkt_rf+smb+hml+cma', 'mkt_rf+smb+hml+rmw+cma']
    for factor_names in factor_scenarios:
        factor_names = factor_names.split('+')
        X = df[factor_names].dropna()
        Y = df['weighted_return'].dropna()
        Y = Y[X.index]
        reg = sm.OLS(Y, X)
        results = reg.fit()
        score = results.rsquared
        factor_names = "\n".join(factor_names)
        _factors.append(factor_names)
        _scores.append(score)
    return _factors, _scores

def draw_R2_hist(df):
    _factors, _scores = estimate_R2_hist(df)
    plt.cla()
    plt.figure(figsize=(8, 3))
    plt.title('Explanatory power ($R^2$) of factor combinations')
    plt.ylim(0, 1), plt.ylabel("$R^2$")
    plt.bar(_factors, _scores,
            color=5 * ['red'] + 2 * ['lightgreen'] + 1 * ['green'] + 2 * ['lightblue'] + 1 * ['blue'])
    plt.show()

def get_predict_curve(df, factor_list):
    """
    计算预测曲线
    """
    X = df[factor_list]
    X = X.dropna()
    y = df['weighted_return'].dropna()
    y = y[X.index]

    daterange = df['date']
    daterange = daterange[X.index]

    train_size = int(len(X) * 0.7)
    X_train, X_test = X[:train_size], X[train_size:]
    y_train, y_test = y[:train_size], y[train_size:]

    model = regression(X_train, y_train)
    print("R^2: {}".format(model.rsquared))
    print(model.summary())

    # 测试集预测
    X_test = sm.add_constant(X_test)
    y_pred = model.predict(X_test)

    return daterange[train_size:], y_pred, y_test, model
    
def coloriter(array, cmap_name, alpha=None) -> List:
    cm = plt.cm.get_cmap(cmap_name)
    o = list()
    for item, position in zip(array, np.linspace(0, 1, len(array))):
        c = cm(position)
        c = tuple([*c[0:3], alpha or 1.0])
        o.append((item, c))
    return o

if __name__ == "__main__":
    FACTOR_DIR = 'fivefactor_daily.csv'
    BASE_PATH = 'his_sh1_201907-202406'
    START_DATE = '20190701'
    END_DATE = '20240630'
    
    stock_list = {
        # '000002': 1
        '000002': 0.5,
        '600000': 0.3,
        '600096': 0.2
    }
    df_returns = get_returns(BASE_PATH, START_DATE, END_DATE, stock_list)
    # print(df_returns.tail(10))

    factor_list = ['rmw', 'mkt_rf', 'smb', 'hml', 'cma']

    df_factors = load_factors(FACTOR_DIR)

    df_returns['date'] = pd.to_datetime(df_returns['date'])
    df_factors.index = pd.to_datetime(df_factors.index)

    df = df_returns.merge(df_factors, left_on='date', right_index=True, how='left')    

    '''各因子组合的解释力'''
    _factors, _scores = estimate_R2_hist(df)
    '''factor_list 因子组合的预测曲线'''
    daterange_test, y_pred, y_test, model = get_predict_curve(df, factor_list)
    '''各因子 vs 加权收益率的散点图'''
    maxFigWidth = 22
    plt.figure(figsize=(maxFigWidth, 3))
    for iFactor, (factor, color) in enumerate(coloriter(factor_list, 'tab10')):
        if factor in factor_list:
            plt.subplot(1, len(factor_list), iFactor + 1)
            X = df[factor].dropna()
            Y = df['weighted_return'].dropna()
            plt.axhline(0.0, color='black', linestyle='dotted')
            plt.axvline(0.0, color='black', linestyle='dotted')
            plt.gca().xaxis.set_major_formatter(mtick.FormatStrFormatter('%.0f bp'))
            plt.gca().yaxis.set_major_formatter(mtick.FormatStrFormatter('%.0f bp'))
            plt.scatter(X * 1e4, Y * 1e4, color=color, s=1), plt.title(
                f"Actual ret. vs. {factor}")
    plt.subplots_adjust(wspace=0.3)
    plt.show()



    # 可视化
    plt.figure(figsize=(10, 5))
    # print(daterange)
    plt.plot(daterange_test, y_test.values, label='True', linewidth=2)
    plt.plot(daterange_test, y_pred.values, label='Predicted')
    plt.title('True vs Predicted Stock Return (Test Set)')
    plt.legend()
    plt.grid(True)
    plt.show()

    draw_R2_hist(df)