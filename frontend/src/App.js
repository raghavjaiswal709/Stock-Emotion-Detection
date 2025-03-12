import React, { useState } from 'react';
import Plot  from 'react-plotly.js';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';

// Constants for the application
const COMPANIES = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META'];

const EMOTION_MAPPING = {
  'anger': {'emoji': '👿', 'color': '#ff4d4d', 'description': "intense feeling of frustration or annoyance"},
  'depression': {'emoji': '🤬', 'color': '#4a90e2', 'description': "deep sadness or gloom, like a rainy day"},
  'sad': {'emoji': '😢', 'color': '#9b9b9b', 'description': "feeling of sorrow or unhappiness"},
  'confusion': {'emoji': '😕', 'color': '#f5a623', 'description': "state of being puzzled or uncertain"},
  'neutral': {'emoji': '😐', 'color': '#b8e986', 'description': "a balanced, calm state"},
  'optimism': {'emoji': '😊', 'color': '#7ed321', 'description': "feeling of hope and positivity"},
  'amusement': {'emoji': '🥰', 'color': '#bd10e0', 'description': "joy from being entertained"},
  'excitement': {'emoji': '🚀', 'color': '#50e3c2', 'description': "burst of enthusiasm and eagerness"},
  'surprise': {'emoji': '🥳', 'color': '#f8e71c', 'description': "feeling of unexpected wonder"}
};

const TIME_RANGES = {
  '1D': '1 Day',
  '1W': '1 Week',
  '2W': '2 Weeks',
  '1M': '1 Month',
  '3M': '3 Months',
  '6M': '6 Months',
  '1Y': '1 Year',
  '2Y': '2 Years',
  '5Y': '5 Years',
  'YTD': 'Year to Date'
};

const CHART_TYPES = {
  'candlestick': 'Candlestick Chart',
  'line': 'Line Chart',
  'ohlc': 'OHLC Chart',
  'area': 'Area Chart',
  'bar': 'Bar Chart',
  'scatter': 'Scatter Plot'
};

// Function to generate mock stock data
const generateMockStockData = (days = 180) => {
  const now = new Date();
  const data = {
    prices: {
      dates: [],
      open: [],
      high: [],
      low: [],
      close: []
    },
    volume: {
      dates: [],
      values: [],
      colors: []
    },
    emotions: {
      dates: [],
      emotionData: Object.keys(EMOTION_MAPPING).reduce((acc, emotion) => {
        acc[emotion] = [];
        return acc;
      }, {})
    },
    emotion_distribution: Object.keys(EMOTION_MAPPING).reduce((acc, emotion) => {
      acc[emotion] = Math.floor(Math.random() * 100);
      return acc;
    }, {})
  };

  let basePrice = 150;
  let volatility = 2;

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - i));
    
    // Generate OHLC data
    const change = (Math.random() - 0.5) * volatility;
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    
    basePrice = close;

    // Prices
    data.prices.dates.push(date);
    data.prices.open.push(open);
    data.prices.high.push(high);
    data.prices.low.push(low);
    data.prices.close.push(close);

    // Volume
    const volume = Math.floor(Math.random() * 1000000) + 500000;
    data.volume.dates.push(date);
    data.volume.values.push(volume);
    data.volume.colors.push(close >= open ? '#26a69a' : '#ef5350');

    // Emotions
    data.emotions.dates.push(date);
    Object.keys(EMOTION_MAPPING).forEach(emotion => {
      data.emotions.emotionData[emotion].push(Math.random());
    });
  }

  return data;
};

// Utility functions for technical indicators
const calculateSMA = (data, period) => {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
};

const calculateRSI = (prices, period = 14) => {
  const changes = prices.slice(1).map((price, i) => price - prices[i]);
  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? -change : 0);
  
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  
  const RS = avgGain / avgLoss;
  return 100 - (100 / (1 + RS));
};

const calculateEMA = (prices, period) => {
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
};

const calculateMACD = (prices, fastPeriod = 12, slowPeriod = 26) => {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  return fastEMA - slowEMA;
};

export default function EnhancedStockDashboard() {
  // State management
  const [selectedCompany, setSelectedCompany] = useState(COMPANIES[0]);
  const [timeRange, setTimeRange] = useState('6M');
  const [chartHeight, setChartHeight] = useState(700);
  const [chartWidth, setChartWidth] = useState('100%');
  const [selectedChartType, setSelectedChartType] = useState('line');
  const [showEmojis, setShowEmojis] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  // Get days for selected time range
  const getDaysForTimeRange = (range) => {
    switch (range) {
      case '1D': return 1;
      case '1W': return 7;
      case '2W': return 14;
      case '1M': return 30;
      case '3M': return 90;
      case '6M': return 180;
      case '1Y': return 365;
      case '2Y': return 730;
      case '5Y': return 1825;
      case 'YTD': {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
      }
      default: return 180;
    }
  };

  // Generate mock data based on selected time range
  const stockData = generateMockStockData(getDaysForTimeRange(timeRange));

  // Render main chart
  const renderMainChart = () => {
    if (!stockData?.prices) return null;

    const { dates, open, high, low, close } = stockData.prices;
    let chartData = [];
    
    const emojis = close.map((currentClose, i) => {
      if (i === 0) return '😐';
      const prevClose = close[i - 1];
      const percentChange = ((currentClose - prevClose) / prevClose) * 100;
      
      if (percentChange > 2) return '🥳';
      if (percentChange > 1) return '🥰';
      if (percentChange > 0) return '🚀';
      if (percentChange > -1) return '😕';
      if (percentChange > -2) return '🤬';
      return '😢';
    });

    switch (selectedChartType) {
      case 'candlestick':
        chartData = [{
          type: 'candlestick',
          x: dates,
          open: open,
          high: high,
          low: low,
          close: close,
          increasing: { line: { color: '#26a69a' } },
          decreasing: { line: { color: '#ef5350' } },
          name: 'Price',
          text: showEmojis ? emojis : undefined,
          textposition: 'top center',
          showlegend: true
        }];
        break;

      case 'line':
        chartData = [{
          type: 'scatter',
          x: dates,
          y: close,
          line: { color: '#2196F3', width: 2 },
          name: 'Close Price',
          text: showEmojis ? emojis : undefined,
          mode: 'lines+markers+text',
          textposition: 'top center',
          marker: {
            size: 8,
            color: close.map((val, i) => 
              i > 0 ? (val >= close[i-1] ? '#26a69a' : '#ef5350') : '#26a69a'
            )
          }
        }];
        break;

      case 'ohlc':
        chartData = [{
          type: 'ohlc',
          x: dates,
          open: open,
          high: high,
          low: low,
          close: close,
          increasing: { line: { color: '#26a69a' } },
          decreasing: { line: { color: '#ef5350' } },
          name: 'Price'
        }];
        break;

      case 'area':
        chartData = [{
          type: 'scatter',
          x: dates,
          y: close,
          fill: 'tozeroy',
          fillcolor: 'rgba(33, 150, 243, 0.3)',
          line: { color: '#2196F3' },
          name: 'Close Price'
        }];
        break;

      case 'bar':
        chartData = [{
          type: 'bar',
          x: dates,
          y: close,
          marker: {
            color: close.map((val, i) => 
              val >= (i > 0 ? close[i-1] : val) ? '#26a69a' : '#ef5350'
            )
          },
          name: 'Close Price'
        }];
        break;

      case 'scatter':
        chartData = [{
          type: 'scatter',
          x: dates,
          y: close,
          mode: 'markers',
          marker: {
            size: 8,
            color: '#2196F3'
          },
          name: 'Close Price'
        }];
        break;
    }

    // Add Moving Averages
    chartData.push({
      type: 'scatter',
      x: dates,
      y: calculateSMA(close, 20),
      line: { color: '#FFA500', width: 1, dash: 'dash' },
      name: '20-day SMA'
    });

    chartData.push({
      type: 'scatter',
      x: dates,
      y: calculateSMA(close, 50),
      line: { color: '#FF00FF', width: 1, dash: 'dash' },
      name: '50-day SMA'
    });

    return (
      <Plot
        data={chartData}
        layout={{
          height: chartHeight,
          autosize: true,
          title: {
            text: `${selectedCompany} Stock Price - ${selectedChartType.charAt(0).toUpperCase() + selectedChartType.slice(1)}`,
            font: { size: 24 }
          },
          yaxis: { 
            title: 'Price ($)',
            fixedrange: false,
            autorange: true,
            tickformat: '.2f'
          },
          xaxis: { 
            title: 'Date',
            rangeslider: { visible: true },
            type: 'date',
            fixedrange: false
          },
          margin: { l: 60, r: 60, t: 80, b: 60 },
          showlegend: true,
          legend: {
            orientation: 'h',
            yanchor: 'bottom',
            y: -0.2,
            xanchor: 'center',
            x: 0.5
          },
          dragmode: 'zoom',
          hovermode: 'x unified'
        }}
        config={{
          responsive: true,
          displaylogo: false,
          modeBarButtonsToAdd: [
            'drawline',
            'drawopenpath',
            'drawclosedpath',
            'drawcircle',
            'drawrect',
            'eraseshape'
          ],
          scrollZoom: true
        }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
        className="w-full"
      />
    );
  };

  // Render emotion timeline
  const renderEmotionTimeline = () => {
    if (!stockData?.emotions || !showEmojis) return null;

    const { dates, emotionData } = stockData.emotions;
    
    const traces = Object.keys(EMOTION_MAPPING).map(emotion => ({
      type: 'scatter',
      x: dates,
      y: emotionData[emotion],
      name: `${EMOTION_MAPPING[emotion].emoji} ${emotion}`,
      line: { color: EMOTION_MAPPING[emotion].color },
      mode: 'lines+markers',
      marker: {
        symbol: 'circle',
        size: 8
      }
    }));

    return (
      <Plot
        data={traces}
        layout={{
          height: chartHeight * 0.6,
          autosize: true,
          title: 'Emotion Timeline',
          yaxis: { 
            title: 'Emotion Intensity',
            range: [0, 1]
          },
          xaxis: { title: 'Date' },
          margin: { l: 50, r: 50, t: 50, b: 50 },
          showlegend: true,
          legend: {
            orientation: 'h',
            yanchor: 'bottom',
            y: -0.2,
            xanchor: 'center',
            x: 0.5
          }
        }}
        config={{ responsive: true }}
        className="w-full"
      />
    );
  };

  // Render volume chart
  const renderVolumeChart = () => {
    if (!stockData?.volume || !showVolume) return null;

    const { dates, values, colors } = stockData.volume;

    return (
      <Plot
        data={[
          {
            type: 'bar',
            x: dates,
            y: values,
            marker: {
              color: colors,
              line: {
                color: colors,
                width: 1
              }
            },
            name: 'Volume'
          }
        ]}
        layout={{
          height: chartHeight * 0.4,
          autosize: true,
          title: 'Trading Volume',
          yaxis: { 
            title: 'Volume',
            tickformat: '.0f'
          },
          xaxis: { title: 'Date' },
          margin: { l: 50, r: 50, t: 50, b: 50 }
        }}
        config={{ responsive: true }}
        className="w-full"
      />
    );
  };

  // Render emotion distribution pie chart
  const renderEmotionPieChart = () => {
    if (!stockData?.emotion_distribution) return null;

    const data = Object.entries(stockData.emotion_distribution).map(([emotion, count]) => ({
      values: [count],
      labels: [emotion],
      type: 'pie',
      name: emotion,
      marker: {
        colors: [EMOTION_MAPPING[emotion].color]
      },
      text: [EMOTION_MAPPING[emotion].emoji],
      textinfo: 'label+percent',
      hoverinfo: 'label+value',
      hole: 0.4
    }));

    return (
      <Plot
        data={data}
        layout={{
          height: chartHeight * 0.6,
          autosize: true,
          title: 'Emotion Distribution',
          showlegend: true,
          legend: {
            orientation: 'h',
            yanchor: 'bottom',
            y: -0.2,
            xanchor: 'center',
            x: 0.5
          }
        }}
        config={{ responsive: true }}
        className="w-full"
      />
    );
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-6">Stock & Emotion Analysis Dashboard</h1>
      
      {/* Controls Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Select Company:</label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="w-full p-2 border rounded"
          >
            {COMPANIES.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Time Range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="w-full p-2 border rounded"
          >
            {Object.entries(TIME_RANGES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Chart Type:</label>
          <select
            value={selectedChartType}
            onChange={(e) => setSelectedChartType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            {Object.entries(CHART_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Chart Height:</label>
          <input
            type="range"
            min="300"
            max="800"
            step="50"
            value={chartHeight}
            onChange={(e) => setChartHeight(Number(e.target.value))}
            className="w-full"
          />
          <span className="text-sm text-gray-600">{chartHeight}px</span>
        </div>
      </div>

      {/* Toggle Controls */}
      <div className="flex gap-4 mb-6">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showVolume}
            onChange={(e) => setShowVolume(e.target.checked)}
            className="form-checkbox"
          />
          <span>Show Volume Chart</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showEmojis}
            onChange={(e) => setShowEmojis(e.target.checked)}
            className="form-checkbox"
          />
          <span>Show Emojis</span>
        </label>
      </div>

      {/* Charts Section */}
      <div className="space-y-6">
        {/* Main Chart */}
        <Card className="bg-white p-4 rounded-lg shadow">
          <CardContent>
            {renderMainChart()}
          </CardContent>
        </Card>

        {/* Emotion Timeline */}
        <Card className="bg-white p-4 rounded-lg shadow">
          <CardContent>
            {renderEmotionTimeline()}
          </CardContent>
        </Card>

        {/* Volume Chart */}
        <Card className="bg-white p-4 rounded-lg shadow">
          <CardContent>
            {renderVolumeChart()}
          </CardContent>
        </Card>

        {/* Technical Indicators Section */}
        <Card className="bg-white p-4 rounded-lg shadow">
          <CardHeader>
            <CardTitle>Technical Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {stockData.prices && (
                <>
                  <div className="p-4 rounded bg-gray-50">
                    <div className="text-lg font-semibold">RSI</div>
                    <div className="text-2xl text-blue-600">
                      {calculateRSI(stockData.prices.close).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 rounded bg-gray-50">
                    <div className="text-lg font-semibold">MACD</div>
                    <div className="text-2xl text-blue-600">
                      {calculateMACD(stockData.prices.close).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 rounded bg-gray-50">
                    <div className="text-lg font-semibold">20-day SMA</div>
                    <div className="text-2xl text-blue-600">
                      {calculateSMA(stockData.prices.close, 20).slice(-1)[0]?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  <div className="p-4 rounded bg-gray-50">
                    <div className="text-lg font-semibold">50-day SMA</div>
                    <div className="text-2xl text-blue-600">
                      {calculateSMA(stockData.prices.close, 50).slice(-1)[0]?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Emotion Distribution Cards */}
        <Card className="bg-white p-4 rounded-lg shadow">
          <CardHeader>
            <CardTitle>Detailed Emotion Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(stockData.emotion_distribution || {}).map(([emotion, count]) => (
                <div 
                  key={emotion} 
                  className="p-4 rounded transition-all duration-300 hover:shadow-lg"
                  style={{ 
                    backgroundColor: `${EMOTION_MAPPING[emotion].color}20`,
                    borderLeft: `4px solid ${EMOTION_MAPPING[emotion].color}`
                  }}
                >
                  <div className="text-2xl mb-2">
                    {EMOTION_MAPPING[emotion].emoji} {emotion}
                  </div>
                  <div className="text-lg font-semibold">{count} occurrences</div>
                  <div className="text-sm text-gray-600">
                    {EMOTION_MAPPING[emotion].description}
                  </div>
                  <div className="mt-2 text-sm">
                    Percentage: {((count / Object.values(stockData.emotion_distribution).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        <Card className="bg-white p-4 rounded-lg shadow">
          <CardHeader>
            <CardTitle>Market Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded bg-gray-50">
                <div className="text-sm text-gray-600">Total Volume</div>
                <div className="text-xl font-semibold">
                  {stockData.volume?.values.reduce((a, b) => a + b, 0).toLocaleString()}
                </div>
              </div>
              <div className="p-4 rounded bg-gray-50">
                <div className="text-sm text-gray-600">Price Change</div>
                <div className={`text-xl font-semibold ${
                  stockData.prices.close[stockData.prices.close.length - 1] > stockData.prices.close[0]
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {((stockData.prices.close[stockData.prices.close.length - 1] - stockData.prices.close[0]) / 
                    stockData.prices.close[0] * 100).toFixed(2)}%
                </div>
              </div>
              <div className="p-4 rounded bg-gray-50">
                <div className="text-sm text-gray-600">Average Volume</div>
                <div className="text-xl font-semibold">
                  {Math.floor(stockData.volume?.values.reduce((a, b) => a + b, 0) / 
                    stockData.volume?.values.length).toLocaleString()}
                </div>
              </div>
              <div className="p-4 rounded bg-gray-50">
                <div className="text-sm text-gray-600">Dominant Emotion</div>
                <div className="text-xl font-semibold flex items-center">
                  {Object.entries(stockData.emotion_distribution || {})
                    .reduce((a, b) => a[1] > b[1] ? a : b)[0]}
                  {' '}
                  {EMOTION_MAPPING[Object.entries(stockData.emotion_distribution || {})
                    .reduce((a, b) => a[1] > b[1] ? a : b)[0]]?.emoji}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}