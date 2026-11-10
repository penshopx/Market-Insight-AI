// Manual mock for @react-native-community/netinfo.
// Reports the device as "online" so isOnlineRef is true and manualFlush works.
// addEventListener is stubbed to a no-op so auto-flush from connectivity
// events never fires — tests drive flushes manually.
const NetInfo = {
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true }),
  ),
};

module.exports = NetInfo;
module.exports.default = NetInfo;
