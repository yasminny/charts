/* -----------------------
* IMPORTS
* --------------------- */
const {
	Component,
	createRef,
	Fragment,
	PureComponent
} = React;
const {
	css,
	injectGlobal,
	keyframes,
	ThemeProvider,
	withTheme,
	default: styled
} = styled;
const {
	easeCubicOut,
	extent,
	interpolatePath,
	line,
	scaleLinear,
	scaleTime,
	select
} = d3;

/* -----------------------
* THEME
* --------------------- */
const PIXEL_SCALE = 4;
const scale = PIXEL_SCALE / 16;

const breakpoint = {
	up: {
		xl: 1440,
		lg: 1024,
		md: 768,
		sm: 576,
	},
	down: {
		lg: 1439,
		md: 1023,
		sm: 767,
		xs: 575,
	},
};

const color = {
	bg: '#000',
	text: '#fff'
};

const font = {
	primary: `'Roboto Mono', monospace`,
};

const fontWeight = {
	black: '900',
	bold: '700',
	semibold: '600',
	medium: '500',
	regular: '400',
	light: '300',
	extralight: '200',
};

const spacing = {
	xsmall: scale,
	small: scale * 2,
	medium: scale * 4,
	large: scale * 8,
	xlarge: scale * 16,
};

const theme = {
	breakpoint,
	color,
	font,
	fontWeight,
	scale,
	spacing,
};

/* -----------------------
* DATA CONSTANTS
* --------------------- */
const API_BASE = 'https://www.coinbase.com/api/v2/prices/';
const API_HISTORY = 'historic?period=';
const API_SPOT = 'spot';
const COIN_OPTIONS = [
	'BTC',
	'BCH',
	'ETH',
	'LTC'
];
const PERIOD_OPTIONS = [
	{
		value: 'hour',
		label: '1H',
	},
	{
		value: 'day',
		label: '1D',
	},
	{
		value: 'week',
		label: '1W',
	},
	{
		value: 'month',
		label: '1M',
	},
	{
		value: 'year',
		label: '1Y',
	},
	{
		value: 'all',
		label: 'ALL',
	},
];

/* -----------------------
* UTILS
* --------------------- */
const formatValueHistory = prices =>
	prices
		.map(p => ({
			price: Number(p.price),
			time: new Date(p.time),
		}))
		.sort((a, b) => a.time - b.time);

const scalePrices = (
	data,
	height,
	width,
	paddingTop = 0,
	paddingBottom = 0,
	paddingLeft = 0,
	paddingRight = 0
) => {
	const priceToY = scaleLinear()
		.range([height - paddingBottom, paddingTop])
		.domain(extent(data, d => d.price));

	const timeToX = scaleTime()
		.range([paddingLeft, width - paddingRight])
		.domain(extent(data, d => d.time));

	return data.map(({ price, time }) => ({
		price: priceToY(price),
		time: timeToX(time),
	}));
};

const lineFromPrices = line()
	.x(d => d.time)
	.y(d => d.price);

const NUMBER_REG = /\B(?=(\d{3})+(?!\d))/g;

const getSign = (price: number, hidePlus: boolean) => {
	if (!hidePlus && price > 0) {
		return '+';
	}

	if (price < 0) {
		return '-';
	}

	return '';
};

const formatNumberString = (
	price,
	symbol = '',
	hidePlus = false,
	symbolAfter = false,
) => {
	if (typeof price === 'number') {
		const sign = getSign(price, hidePlus);
		const string = Math.abs(price).toFixed(2);
		const parts = string.split('.');
		parts[0] = parts[0].replace(NUMBER_REG, ',');
		return `${sign}${symbolAfter ? '' : symbol}${parts.join('.')}${symbolAfter ? symbol : ''}`;
	}

	return null;
};

const deriveValueDelta = (
	currentValue,
	valueHistory
) => {
	if (
		typeof currentValue === 'number' &&
		Array.isArray(valueHistory) &&
		valueHistory.length > 0 &&
		valueHistory[0].price
	) {
		return currentValue - valueHistory[0].price;
	}

	return null;
};

const derivePercentDelta = (
	currentValue,
	valueHistory
) => {
	if (
		Array.isArray(valueHistory) &&
		valueHistory.length > 0 &&
		valueHistory[0].price
	) {
		return (
			((currentValue - valueHistory[0].price) /
				Math.abs(valueHistory[0].price)) *
			100 || 0
		);
	}

	return null;
};


/* -----------------------
* DATA FETCHING
* --------------------- */
const fetchValueHistory = async (coin, period) => {
	const d = await fetch(`${API_BASE}${coin}-USD/${API_HISTORY}${period}`).then(r => r.json());
	const prices = d && d.data && d.data.prices;

	if (Array.isArray(prices) && prices.length > 0) {
		return formatValueHistory(prices);
	}

	throw new Error('invalid price data returned');
};

const fetchCurrentValue = async coin => {
	const d = await fetch(`${API_BASE}${coin}-USD/${API_SPOT}`).then(r => r.json());
	const spot = d && d.data && d.data.amount;

	if (typeof spot === 'string') {
		return Number(spot);
	}

	throw new Error('invalid spot data returned');
};

/* -----------------------
* COMPONENT: <Line />
* --------------------- */
const LINE_DUMMY = Array(2)
	.fill()
	.map((a, i) => ({ price: 0, time: new Date(2010 + i) }));
const PADDING = 24;
const TRANSITION_DURATION = 500;

const safePrices = prices =>
	Array.isArray(prices) && prices.length > 1 ? prices : LINE_DUMMY;

const Svg = styled.svg`
  height: 100%;
  width: 100%;
  pointer-events: none;
  flex: 1 0 ${({theme}) => theme.scale * 40}rem;
`;

class LineBase extends PureComponent {
	pathRef = createRef();
	svgRef = createRef();

	componentDidMount() {
		if (
			this.pathRef &&
			this.pathRef.current &&
			this.svgRef &&
			this.svgRef.current
		) {
			const { height, width } = this.svgRef.current.getBoundingClientRect();
			const { prices } = this.props;
			this.path = select(this.pathRef.current);

			this.height = height;
			this.width = width;

			const d = lineFromPrices(
				scalePrices(safePrices(prices), height, width, PADDING, PADDING)
			);
			this.path.attr('d', d);
			this.d = d;

			window.addEventListener('resize', this.handleResize);
		}
	}

	componentDidUpdate() {
		this.updatePath();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize);
	}

	handleResize = () => {
		if (this.svgRef && this.svgRef.current) {
			const { height, width } = this.svgRef.current.getBoundingClientRect();
			this.height = height;
			this.width = width;

			this.updatePath();
		}
	};

	updatePath = () => {
		const { prices } = this.props;

		const d = lineFromPrices(
			scalePrices(safePrices(prices), this.height, this.width, PADDING, PADDING)
		);

		this.path
			.transition()
			.duration(TRANSITION_DURATION)
			.ease(easeCubicOut)
			.attrTween('d', interpolatePath.bind(null, this.d, d));

		this.d = d;
	};

	render() {
		return (
			<Svg innerRef={this.svgRef}>
				<path fill="none" ref={this.pathRef} stroke={this.props.theme.color.text} strokeWidth="1.5" />
			</Svg>
		);
	}
}

const Line = withTheme(LineBase);

/* -----------------------
* COMPONENT: <PeriodSwitcher />
* --------------------- */
const PeriodButton = styled.button`
  isolation: isolate;
  perspective: 1px;
  position: relative;
  display: inline-block;
  height: ${({ theme }) => theme.spacing.large}rem;
  width: ${({ theme }) => theme.spacing.large}rem;
  margin: 0 0.5em;
  padding: 0;
  border: none;
  background: transparent;
  font-family: ${({ theme }) => theme.font.primary};
  font-size: 1rem;
  text-align: center;
  text-decoration: none;
  letter-spacing: 0.125em;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;

  &::before {
    content: '';
    z-index: -1;
    position: absolute;
    bottom: 0;
    left: 0;
    height: 1px;
    width: 100%;
    background-color: ${({ theme }) => theme.color.text};
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &::after {
    content: '';
    z-index: 2;
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    background: ${({ theme }) => theme.color.text};
    transform-origin: 50% 50%;
    transform: ${({ active }) =>
	active ? 'scale3d(1, 1, 1)' : 'scale3d(1, 0, 1)'};
    transition: transform 0.2s ease;
    mix-blend-mode: difference;
  }

  &:focus {
    outline: none;

    &::before {
      opacity: ${({ active }) => (active ? 0 : 0.75)};
    }

    &:active::before {
      opacity: 0;
    }
  }
`;

const PeriodText = styled.span`
  color: ${({ theme }) => theme.color.text};
  user-select: none;
  opacity: ${({ active }) => (active ? 1 : 0.75)};
  transition: opacity 0.2s ease;
`;

class PeriodItem extends PureComponent {
	static defaultProps = {
		active: false,
		children: null,
		onClick: null,
		value: null,
	};

	handleClick = e => {
		const { onClick, value } = this.props;
		if (typeof onClick === 'function') {
			onClick(e, value);
		}
	};

	render() {
		const { active, children } = this.props;
		return (
			<PeriodButton active={active} onClick={this.handleClick}>
				<PeriodText active={active}>{children}</PeriodText>
			</PeriodButton>
		);
	}
}

const PeriodSwitcherWrapper = styled.div`
  display: flex;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
`;

class PeriodSwitcher extends PureComponent {
	static defaultProps = {
		onChange: null,
		options: [],
		value: null,
	};

	render() {
		const { onChange, options, value } = this.props;

		return (
			<PeriodSwitcherWrapper>
				{Array.isArray(options) &&
				options.map(o => (
					<PeriodItem
						active={value === o.value}
						key={o.value}
						onClick={onChange}
						value={o.value}
					>
						{o.label}
					</PeriodItem>
				))}
			</PeriodSwitcherWrapper>
		);
	}
}

/* -----------------------
* COMPONENT: <Overview />
* --------------------- */
const OverviewItemButton = styled.button`
  padding: ${({ theme }) =>
	`${theme.spacing.small}rem ${theme.spacing.medium}rem`};
  flex: 1 0 0;
  border: none;
  text-align: center;
  background: transparent;
  font-family: ${({ theme }) => theme.font.primary};
  text-decoration: none;
  cursor: pointer;
  color: ${({theme}) => theme.color.text};
  -webkit-appearance: none;
  -moz-appearance: none;

  &:focus {
    outline: none;
  }
`;

const Value = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.small}rem;
  font-size: 1.5rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  line-height: 1.5;
`;

const Label = styled.div`
  font-size: 0.75rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  line-height: 1.3333;
  letter-spacing: 0.125em;
  text-transform: uppercase;
`;

const OverviewItem = ({ children, label, onClick }) => (
	<OverviewItemButton onClick={onClick}>
		<Value>{children || <Fragment>&nbsp;</Fragment>}</Value>
		<Label>{label}</Label>
	</OverviewItemButton>
);

OverviewItem.defaultProps = {
	children: null,
	label: '',
	onClick: null,
};

const OverviewWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  flex: 0 0 auto;
  width: 100%;
  max-width: ${({ theme }) => theme.scale * 148}rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.large}rem 0;
  color: ${({ theme }) => theme.color.text};
`;

class Overview extends PureComponent {
	state = {
		calcPercentage: false
	}

	togglePercentage = () => {
		this.setState(prevState => ({
			calcPercentage: !prevState.calcPercentage
		}));
	}

	render() {
		const { coin, currentValue, cycleCoinIndex, valueHistory } = this.props;
		const { calcPercentage } = this.state;
		const delta = calcPercentage
			? formatNumberString(derivePercentDelta(currentValue, valueHistory), '%', false, true)
			: formatNumberString(deriveValueDelta(currentValue, valueHistory), '$');

		return (
			<OverviewWrapper>
				<OverviewItem onClick={this.props.cycleCoinIndex} label={`${coin} Price`}>
					{formatNumberString(currentValue, '$', true)}
				</OverviewItem>
				<OverviewItem onClick={this.togglePercentage} label={`${calcPercentage ? 'Percent' : 'Price'} Change`}>
					{delta}
				</OverviewItem>
			</OverviewWrapper>
		);
	}
}

/* -----------------------
* COMPONENT: <Heading />
* --------------------- */
const Heading = styled.h1`
  margin: 0;
  padding-top: ${({ theme }) => theme.spacing.large * 1.5}rem;
  font-size: 0.875rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  letter-spacing: 0.0625rem;
  text-transform: uppercase;
  text-align: center;
`;

/* -----------------------
* COMPONENT: <CryptoChart />
* --------------------- */
class CryptoChart extends PureComponent {
	state = {
		coinIndex: 0,
		currentValue: null,
		period: PERIOD_OPTIONS[0].value,
		valueHistory: [],
	}

	componentDidMount() {
		this.fetchData();
	}

	cycleCoinIndex = () => {
		this.setState(prevState => ({
			coinIndex: (prevState.coinIndex + 1) % COIN_OPTIONS.length
		}), this.fetchData);
	}

	setPeriod = (e, period) => {
		this.setState({ period }, this.fetchData);
	};

	componentWillUnmount() {
		clearTimeout(this.fetchTimeout);
	}

	fetchData = async () => {
		clearTimeout(this.fetchTimeout);
		const { coinIndex, period } = this.state;

		try {
			const currentValue = await fetchCurrentValue(COIN_OPTIONS[coinIndex]);
			const valueHistory = await fetchValueHistory(COIN_OPTIONS[coinIndex], period);
			this.setState({ currentValue, valueHistory });
		} catch (e) {
			console.warn(e);
		}

		this.fetchTimeout = setTimeout(this.fetchData, 30000);
	};

	render() {
		const { coinIndex, currentValue, period, valueHistory } = this.state;

		return (
			<Fragment>
				<Heading>Khajiit Has Warez, If You Have Coin</Heading>
				<Overview
					coin={COIN_OPTIONS[coinIndex]}
					cycleCoinIndex={this.cycleCoinIndex}
					currentValue={currentValue}
					valueHistory={valueHistory}
				/>
				<PeriodSwitcher
					onChange={this.setPeriod}
					options={PERIOD_OPTIONS}
					value={period}
				/>
				<Line prices={valueHistory} />
			</Fragment>
		);
	}
}

/* -----------------------
* COMPONENT: <App />
* --------------------- */
const App = () => (
	<ThemeProvider theme={theme}>
		<CryptoChart />
	</ThemeProvider>
);

/* -----------------------
* GLOBAL STYLES
* --------------------- */
injectGlobal`
  html {
    box-sizing: border-box;
  }

  *,
  *:before,
  *:after {
    box-sizing: inherit;
  }

  html,
  body {
    min-height: 100vh;
  }

  body {
    display: flex; 
    margin: 0;
    padding: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: ${theme.color.bg};
    color: ${theme.color.text};
    font-family: 'Roboto Mono', monospace;
    font-weight: 400;
    font-size: 14px;
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
  }

  #root {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 1 100%;
  }
`;

/* -----------------------
* MOUNT/RENDER
* --------------------- */
const app = document.createElement('div');
app.setAttribute('id', 'root');
document.body.appendChild(app);
ReactDOM.render(<App />, app);
