from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import ta
import json

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"]
    }
})

EMOTION_MAPPING = {
    'anger': {'emoji': '😠', 'color': '#ff4d4d', 'description': "intense feeling of frustration or annoyance"},
    'depression': {'emoji': '😢', 'color': '#4a90e2', 'description': "deep sadness or gloom, like a rainy day"},
    'sad': {'emoji': '😔', 'color': '#9b9b9b', 'description': "feeling of sorrow or unhappiness"},
    'confusion': {'emoji': '😕', 'color': '#f5a623', 'description': "state of being puzzled or uncertain"},
    'neutral': {'emoji': '😐', 'color': '#b8e986', 'description': "a balanced, calm state"},
    'optimism': {'emoji': '😊', 'color': '#7ed321', 'description': "feeling of hope and positivity"},
    'amusement': {'emoji': '😄', 'color': '#bd10e0', 'description': "joy from being entertained"},
    'excitement': {'emoji': '🎉', 'color': '#50e3c2', 'description': "burst of enthusiasm and eagerness"},
    'surprise': {'emoji': '😲', 'color': '#f8e71c', 'description': "feeling of unexpected wonder"}
}

COMPANIES = [
    'NVDA','AAPL', 'ABNB', 'AMT', 'AMZN', 'BA', 'BABA', 'BAC', 'BKNG', 'BRK-A', 'BRK-B', 'CCL', 'CVX',
    'DIS', 'META', 'GOOG', 'GOOGL', 'HD', 'JNJ', 'JPM', 'KO', 'LOW', 'MA', 'MCD', 'MSFT', 'NFLX',
    'NKE',  'PFE', 'PG', 'PYPL', 'SBUX', 'TM', 'TSLA', 'TSM', 'UNH', 'UPS', 'V', 'WMT', 'XOM'
]

def assign_emotion(change):
    """Assign emotion based on percentage change with natural thresholds."""
    if pd.isna(change):
        return 'neutral'
    
    change = change * 100  # Convert to percentage for readability
    
    if change <= -8:
        return 'anger'
    elif -8 < change <= -4:
        return 'depression'
    elif -4 < change <= -1:
        return 'sad'
    elif -1 < change <= 1:
        return 'neutral'
    elif 1 < change <= 4:
        return 'optimism'
    elif 4 < change <= 8:
        return 'amusement'
    elif 8 < change <= 15:
        return 'excitement'
    elif change > 15:
        return 'surprise'
    else:
        return 'neutral'

def calculate_technical_indicators(df, time_range):
    """Calculate technical indicators using ta library."""
    # RSI
    df['RSI'] = ta.momentum.RSIIndicator(df['Close']).rsi()
    
    # MACD
    macd = ta.trend.MACD(df['Close'])
    df['MACD'] = macd.macd()
    df['MACD_Signal'] = macd.macd_signal()
    df['MACD_Hist'] = macd.macd_diff()
    
    # Bollinger Bands
    bollinger = ta.volatility.BollingerBands(df['Close'])
    df['BB_Upper'] = bollinger.bollinger_hband()
    df['BB_Middle'] = bollinger.bollinger_mavg()
    df['BB_Lower'] = bollinger.bollinger_lband()
    
    return df

def prepare_emotion_data(df):
    """Prepare emotion-based data with intensities."""
    emotion_data = {emotion: [] for emotion in EMOTION_MAPPING.keys()}
    
    # Calculate daily returns
    returns = df['Close'].pct_change()
    
    for idx in range(len(df)):
        curr_emotion = df['Emotion'].iloc[idx]
        
        # Create intensity values for each emotion
        for emotion in emotion_data.keys():
            if emotion == curr_emotion:
                # Add some random variation to intensity
                intensity = np.random.uniform(0.7, 1.0)
            else:
                intensity = np.random.uniform(0.0, 0.2)
            emotion_data[emotion].append(intensity)
    
    return emotion_data

def resample_data(df, time_range):
    """Resample data for better performance with longer time periods"""
    if time_range in ['5Y', '10Y']:
        rule = 'W'  # Weekly
    elif time_range == 'MAX':
        rule = 'M'  # Monthly
    else:
        return df
    
    return df.resample(rule).agg({
        'Open': 'first',
        'High': 'max',
        'Low': 'min',
        'Close': 'last',
        'Volume': 'sum'
    })

def calculate_additional_statistics(df):
    """Calculate additional statistics for longer time periods"""
    return {
        'all_time_high': float(df['High'].max()),
        'all_time_low': float(df['Low'].min()),
        'avg_daily_volume': float(df['Volume'].mean()),
        'volatility': float(df['Returns'].std() * np.sqrt(252)),  # Annualized volatility
        'max_drawdown': calculate_max_drawdown(df),
        'sharpe_ratio': calculate_sharpe_ratio(df),
        'beta': calculate_beta(df),
        'trading_days': len(df)
    }

def calculate_max_drawdown(df):
    """Calculate maximum drawdown"""
    rolling_max = df['Close'].expanding().max()
    drawdown = (df['Close'] - rolling_max) / rolling_max
    return float(drawdown.min())

def calculate_sharpe_ratio(df, risk_free_rate=0.02):
    """Calculate Sharpe Ratio"""
    returns = df['Returns'].dropna()
    excess_returns = returns - risk_free_rate/252
    return float(np.sqrt(252) * excess_returns.mean() / returns.std())

def calculate_beta(df, market_returns=None):
    """Calculate Beta (simplified version)"""
    if market_returns is None:
        # You might want to fetch S&P 500 returns here
        return 1.0
    returns = df['Returns'].dropna()
    covariance = returns.cov(market_returns)
    market_variance = market_returns.var()
    return float(covariance / market_variance)

def process_stock_data(company, time_range='1M'):
    try:
        # Determine date range
        end_date = datetime.now()
        
        # Set appropriate interval based on time range
        time_range_config = {
            '1D': {
                'days': 1,
                'interval': '1m',
                'start_date': end_date - timedelta(days=1)
            },
            '1W': {
                'days': 7,
                'interval': '5m',
                'start_date': end_date - timedelta(weeks=1)
            },
            '2W': {
                'days': 14,
                'interval': '15m',
                'start_date': end_date - timedelta(weeks=2)
            },
            '1M': {
                'days': 30,
                'interval': '30m',
                'start_date': end_date - timedelta(days=30)
            },
            '3M': {
                'days': 90,
                'interval': '1h',
                'start_date': end_date - timedelta(days=90)
            },
            '6M': {
                'days': 180,
                'interval': '1d',
                'start_date': end_date - timedelta(days=180)
            },
            '1Y': {
                'days': 365,
                'interval': '1d',
                'start_date': end_date - timedelta(days=365)
            },
            '2Y': {
                'days': 730,
                'interval': '1d',
                'start_date': end_date - timedelta(days=730)
            },
            '5Y': {
                'days': 1825,
                'interval': '1wk',
                'start_date': end_date - timedelta(days=1825)
            },
            '10Y': {
                'days': 3650,
                'interval': '1wk',
                'start_date': end_date - timedelta(days=3650)
            },
            'MAX': {
                'days': None,
                'interval': '1mo',
                'start_date': None
            },
            'YTD': {
                'days': None,
                'interval': '1d',
                'start_date': datetime(end_date.year, 1, 1)
            }
        }

        # Get configuration for the requested time range
        range_config = time_range_config.get(time_range)
        if not range_config:
            raise ValueError(f'Invalid time range: {time_range}')

        # Fetch data
        stock = yf.Ticker(company)
        
        if time_range == 'MAX':
            df = stock.history(period='max', interval=range_config['interval'])
        else:
            df = stock.history(
                start=range_config['start_date'],
                end=end_date,
                interval=range_config['interval']
            )

        # Handle empty dataframe
        if df.empty:
            return {
                'success': False,
                'error': f'No data available for {company} in the specified time range'
            }

        # Resample data for longer time periods to improve performance
        if time_range in ['5Y', '10Y', 'MAX']:
            df = resample_data(df, time_range)

        # Calculate technical indicators
        df = calculate_technical_indicators(df, time_range)
        
        # Calculate emotions
        df['Returns'] = df['Close'].pct_change()
        df['Emotion'] = df['Returns'].apply(assign_emotion)
        
        # Prepare emotion data
        emotion_data = prepare_emotion_data(df)
        
        # Create volume colors based on price movement
        volume_colors = ['#26a69a' if close > open else '#ef5350'
                        for close, open in zip(df['Close'], df['Open'])]

        # Format dates based on time range
        date_format = '%Y-%m-%d %H:%M:%S' if time_range in ['1D', '1W', '2W', '1M'] else '%Y-%m-%d'
        dates = df.index.strftime(date_format).tolist()

        # Add additional statistics for longer time periods
        additional_stats = {}
        if time_range in ['1Y', '2Y', '5Y', '10Y', 'MAX']:
            additional_stats = calculate_additional_statistics(df)

        # Handle NaN values
        def clean_nan(data):
            if isinstance(data, (list, np.ndarray)):
                return [float(x) if pd.notnull(x) else None for x in data]
            return data

        response_data = {
            'success': True,
            'prices': {
                'dates': dates,
                'open': clean_nan(df['Open'].tolist()),
                'high': clean_nan(df['High'].tolist()),
                'low': clean_nan(df['Low'].tolist()),
                'close': clean_nan(df['Close'].tolist())
            },
            'emotions': {
                'dates': dates,
                'emotionData': {k: clean_nan(v) for k, v in emotion_data.items()}
            },
            'volume': {
                'dates': dates,
                'values': clean_nan(df['Volume'].tolist()),
                'colors': volume_colors
            },
            'indicators': {
                'dates': dates,
                'rsi': clean_nan(df['RSI'].tolist()),
                'macd': {
                    'line': clean_nan(df['MACD'].tolist()),
                    'signal': clean_nan(df['MACD_Signal'].tolist()),
                    'histogram': clean_nan(df['MACD_Hist'].tolist())
                },
                'bollinger': {
                    'upper': clean_nan(df['BB_Upper'].tolist()),
                    'middle': clean_nan(df['BB_Middle'].tolist()),
                    'lower': clean_nan(df['BB_Lower'].tolist())
                }
            },
            'emotion_distribution': df['Emotion'].value_counts().to_dict(),
            'statistics': additional_stats
        }

        return response_data

    except Exception as e:
        return {'success': False, 'error': str(e)}

@app.route('/api/companies', methods=['GET'])
def get_companies():
    """Return list of available companies."""
    try:
        return jsonify(COMPANIES)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock-data/<company>', methods=['GET'])
def get_stock_data(company):
    """Get stock data for a specific company."""
    try:
        # Validate company symbol
        if company not in COMPANIES:
            return jsonify({
                'success': False,
                'error': 'Invalid company symbol'
            }), 400
        
        # Validate time range
        time_range = request.args.get('range', '1M')
        valid_ranges = ['1D', '1W', '2W', '1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', 'YTD', 'MAX']
        if time_range not in valid_ranges:
            return jsonify({
                'success': False,
                'error': f'Invalid time range. Must be one of: {", ".join(valid_ranges)}'
            }), 400
        
        # Process stock data
        result = process_stock_data(company, time_range)
        
        if not result['success']:
            return jsonify(result), 400
            
        return jsonify(result)

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Add logging configuration
    import logging
    logging.basicConfig(level=logging.INFO)
    
    # Run the application
    app.run(debug=True, port=5000)