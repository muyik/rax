import Host from './host';
import Component from './component';
import invokeFunctionsWithContext from '../invokeFunctionsWithContext';
import { invokeMinifiedError } from '../error';
import { INTERNAL } from '../constant';

const RE_RENDER_LIMIT = 24;
/**
 * Functional Reactive Component Class Wrapper
 */
export default class ReactiveComponent extends Component {
  constructor(pureRender, ref) {
    super();
    // A pure function
    this.__render = pureRender;
    this.__hookID = 0;
    // Number of rerenders
    this.__reRenders = 0;
    this.__hooks = {};
    // Handles store
    this.__didMount = [];
    this.__didUpdate = [];
    this.__willUnmount = [];
    // Is render scheduled
    this.__isScheduled = false;
    this.__shouldUpdate = false;
    this.__children = null;
    this.__dependencies = {};

    this.state = {};

    if (pureRender.forwardRef) {
      this.prevForwardRef = this.forwardRef = ref;
    }

    const compares = pureRender.compares;
    if (compares) {
      this.shouldComponentUpdate = (nextProps) => {
        // Process composed compare
        let arePropsEqual = true;

        // Compare push in and pop out
        for (let i = compares.length - 1; i > -1; i--) {
          if (arePropsEqual = compares[i](this.props, nextProps)) {
            break;
          }
        }

        return !arePropsEqual || this.prevForwardRef !== this.forwardRef;
      };
    }
  }

  __getHooks() {
    return this.__hooks;
  }

  __getHookID() {
    return ++this.__hookID;
  }

  readContext(context) {
    const Provider = context.Provider;
    const contextProp = Provider.contextProp;
    let contextItem = this.__dependencies[contextProp];
    if (!contextItem) {
      const readEmitter = Provider.readEmitter;
      const contextEmitter = readEmitter(this);
      contextItem = {
        emitter: contextEmitter,
        renderedContext: contextEmitter.value,
      };

      const contextUpdater = (newContext) => {
        if (newContext !== contextItem.renderedContext) {
          this.__shouldUpdate = true;
          this.update();
        }
      };

      contextItem.emitter.on(contextUpdater);
      this.__willUnmount.push(() => {
        contextItem.emitter.off(contextUpdater);
      });
      this.__dependencies[contextProp] = contextItem;
    }
    return contextItem.renderedContext = contextItem.emitter.value;
  }

  componentWillMount() {
    this.__shouldUpdate = true;
  }

  componentDidMount() {
    invokeFunctionsWithContext(this.__didMount);
  }

  componentWillReceiveProps() {
    this.__shouldUpdate = true;
  }

  componentDidUpdate() {
    invokeFunctionsWithContext(this.__didUpdate);
  }

  componentWillUnmount() {
    invokeFunctionsWithContext(this.__willUnmount);
  }

  update() {
    this[INTERNAL].__isPendingForceUpdate = true;
    this.setState({});
  }

  render() {
    if (process.env.NODE_ENV !== 'production') {
      Host.measurer && Host.measurer.beforeRender();
    }

    this.__hookID = 0;
    this.__reRenders = 0;
    this.__isScheduled = false;
    let children = this.__render(this.props, this.forwardRef ? this.forwardRef : this.context);

    while (this.__isScheduled) {
      this.__reRenders++;
      if (this.__reRenders > RE_RENDER_LIMIT) {
        if (process.env.NODE_ENV !== 'production') {
          throw new Error('Too many re-renders, the number of renders is limited to prevent an infinite loop.');
        } else {
          invokeMinifiedError(4);
        }
      }

      this.__hookID = 0;
      this.__isScheduled = false;
      children = this.__render(this.props, this.forwardRef ? this.forwardRef : this.context);
    }

    if (this.__shouldUpdate) {
      this.__children = children;
      this.__shouldUpdate = false;
    }

    return this.__children;
  }
}
