import React, { Component } from 'react';
import './App.css';
import LineChart, { parseFlatArray } from 'react-linechart'
const API_BASE = 'https://www.fxempire.com/api/v1/en/markets/eur-usd/chart'

class App extends Component {
  constructor() {
    super()
    this.state = {
      data: [],
			hoverData: undefined
    }
  }

  setData = (type) => {
		fetch(API_BASE + '?time=' +type)
			.then(response => {return response.json()})
			.then( result => {this.setState({ data: result})})
	}

	setBaseData = () => {
		fetch(API_BASE)
			.then(response => {return response.json()})
			.then( result => {this.setState({ data: result})})
	}

  componentDidMount () {
		this.setBaseData()
  }

  render() {
		const gsmFlat = parseFlatArray(this.state.data, "date", ["open", "high", "low", "close"])
		const { hoverData } = this.state
    return (
      <div className="App">
					<h2>Please choose viewing option:</h2>
          <ul className="options">
            <li onClick={() => this.setData('MIN_1')}>1 minute</li>
						<li onClick={() => this.setData('MIN_5')}>5 minutes</li>
						<li onClick={() => this.setData('HOUR_1')}>hourly</li>
						<li onClick={() => this.setBaseData()}>daily</li>
						<li onClick={() => this.setData('WEEK_1')}>weekly</li>
          </ul>
					{
						hoverData && (<div className="hoverPoint">
							<p>You are currently looking at:</p>
							<p>time: {new Date(hoverData.x).toString()}</p>
							<p>value: {hoverData.y}</p>
						</div>)
					}
          {gsmFlat ? <LineChart
						width={1000}
						height={600}
						data={gsmFlat}
						xLabel={'time'}
						yLabel={'value'}
            ticks={6}
						showLegends={true}
						legendPosition={'bottom-left'}
						xDisplay={value => {
							const date = new Date(value)
							return date.toDateString()
						}}
						onPointHover={(e) => this.setState({ hoverData: e })
						 }
					/> : <div>
						<h3>There was an error fetching the data, please try again later</h3>
					</div>}
      </div>
    );
  }
}

export default App;
