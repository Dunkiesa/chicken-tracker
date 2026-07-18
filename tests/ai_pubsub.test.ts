import {
  subscribeToStatusEvents,
  emitStatusEvent,
  _clearAllSubscribers,
} from "@/lib/ai/pubsub";

describe("pubsub", () => {
  afterEach(() => {
    _clearAllSubscribers();
  });

  it("delivers events to subscribers", () => {
    const callback = jest.fn();
    subscribeToStatusEvents("user@test.com", callback);

    emitStatusEvent("user@test.com", {
      imageId: 1,
      status: "processing",
    });

    expect(callback).toHaveBeenCalledWith({
      imageId: 1,
      status: "processing",
    });
  });

  it("does not deliver events to other users", () => {
    const callback = jest.fn();
    subscribeToStatusEvents("user1@test.com", callback);

    emitStatusEvent("user2@test.com", {
      imageId: 1,
      status: "processing",
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("supports multiple subscribers for the same user", () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    subscribeToStatusEvents("user@test.com", cb1);
    subscribeToStatusEvents("user@test.com", cb2);

    emitStatusEvent("user@test.com", {
      imageId: 1,
      status: "succeeded",
      text: "hello",
      bbox: [0.1, 0.2, 0.8, 0.9],
    });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops delivery", () => {
    const callback = jest.fn();
    const unsub = subscribeToStatusEvents("user@test.com", callback);

    emitStatusEvent("user@test.com", { imageId: 1, status: "processing" });
    expect(callback).toHaveBeenCalledTimes(1);

    unsub();

    emitStatusEvent("user@test.com", { imageId: 2, status: "succeeded" });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does nothing when emitting to user with no subscribers", () => {
    expect(() => {
      emitStatusEvent("nobody@test.com", { imageId: 1, status: "failed" });
    }).not.toThrow();
  });

  it("swallows subscriber errors", () => {
    const badCb = jest.fn(() => {
      throw new Error("subscriber error");
    });
    const goodCb = jest.fn();
    subscribeToStatusEvents("user@test.com", badCb);
    subscribeToStatusEvents("user@test.com", goodCb);

    expect(() => {
      emitStatusEvent("user@test.com", { imageId: 1, status: "processing" });
    }).not.toThrow();

    expect(badCb).toHaveBeenCalledTimes(1);
    expect(goodCb).toHaveBeenCalledTimes(1);
  });
});
