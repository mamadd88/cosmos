// L’état métier reste synchrone ; React observe ses instantanés immuables.
export class ObservableStore {
  constructor(props = {}) {
    this.props = props;
  }
  state = {};
  listeners = new Set();
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.state;
  setState(update, callback) {
    const patch = typeof update === 'function' ? update(this.state) : update;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
    callback?.();
  }
}
