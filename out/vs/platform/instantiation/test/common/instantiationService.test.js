var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import assert from "assert";
import { Emitter } from "../../../../base/common/event.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { SyncDescriptor } from "../../common/descriptors.js";
import { createDecorator, IInstantiationService } from "../../common/instantiation.js";
import { InstantiationService } from "../../common/instantiationService.js";
import { ServiceCollection } from "../../common/serviceCollection.js";
const IService1 = createDecorator("service1");
class Service1 {
  constructor() {
    this.c = 1;
  }
}
const IService2 = createDecorator("service2");
class Service2 {
  constructor() {
    this.d = true;
  }
}
const IService3 = createDecorator("service3");
class Service3 {
  constructor() {
    this.s = "farboo";
  }
}
const IDependentService = createDecorator("dependentService");
let DependentService = class {
  constructor(service) {
    this.name = "farboo";
    assert.strictEqual(service.c, 1);
  }
};
DependentService = __decorateClass([
  __decorateParam(0, IService1)
], DependentService);
let Service1Consumer = class {
  constructor(service1) {
    assert.ok(service1);
    assert.strictEqual(service1.c, 1);
  }
};
Service1Consumer = __decorateClass([
  __decorateParam(0, IService1)
], Service1Consumer);
let Target2Dep = class {
  constructor(service1, service2) {
    assert.ok(service1 instanceof Service1);
    assert.ok(service2 instanceof Service2);
  }
};
Target2Dep = __decorateClass([
  __decorateParam(0, IService1),
  __decorateParam(1, IService2)
], Target2Dep);
let TargetWithStaticParam = class {
  constructor(v, service1) {
    assert.ok(v);
    assert.ok(service1);
    assert.strictEqual(service1.c, 1);
  }
};
TargetWithStaticParam = __decorateClass([
  __decorateParam(1, IService1)
], TargetWithStaticParam);
let DependentServiceTarget = class {
  constructor(d) {
    assert.ok(d);
    assert.strictEqual(d.name, "farboo");
  }
};
DependentServiceTarget = __decorateClass([
  __decorateParam(0, IDependentService)
], DependentServiceTarget);
let DependentServiceTarget2 = class {
  constructor(d, s) {
    assert.ok(d);
    assert.strictEqual(d.name, "farboo");
    assert.ok(s);
    assert.strictEqual(s.c, 1);
  }
};
DependentServiceTarget2 = __decorateClass([
  __decorateParam(0, IDependentService),
  __decorateParam(1, IService1)
], DependentServiceTarget2);
let ServiceLoop1 = class {
  constructor(s) {
    this.c = 1;
  }
};
ServiceLoop1 = __decorateClass([
  __decorateParam(0, IService2)
], ServiceLoop1);
let ServiceLoop2 = class {
  constructor(s) {
    this.d = true;
  }
};
ServiceLoop2 = __decorateClass([
  __decorateParam(0, IService1)
], ServiceLoop2);
suite("Instantiation Service", () => {
  test("service collection, cannot overwrite", function() {
    const collection = new ServiceCollection();
    let result = collection.set(IService1, null);
    assert.strictEqual(result, void 0);
    result = collection.set(IService1, new Service1());
    assert.strictEqual(result, null);
  });
  test("service collection, add/has", function() {
    const collection = new ServiceCollection();
    collection.set(IService1, null);
    assert.ok(collection.has(IService1));
    collection.set(IService2, null);
    assert.ok(collection.has(IService1));
    assert.ok(collection.has(IService2));
  });
  test("@Param - simple clase", function() {
    const collection = new ServiceCollection();
    const service = new InstantiationService(collection);
    collection.set(IService1, new Service1());
    collection.set(IService2, new Service2());
    collection.set(IService3, new Service3());
    service.createInstance(Service1Consumer);
  });
  test("@Param - fixed args", function() {
    const collection = new ServiceCollection();
    const service = new InstantiationService(collection);
    collection.set(IService1, new Service1());
    collection.set(IService2, new Service2());
    collection.set(IService3, new Service3());
    service.createInstance(TargetWithStaticParam, true);
  });
  test("service collection is live", function() {
    const collection = new ServiceCollection();
    collection.set(IService1, new Service1());
    const service = new InstantiationService(collection);
    service.createInstance(Service1Consumer);
    collection.set(IService2, new Service2());
    service.createInstance(Target2Dep);
    service.invokeFunction(function(a) {
      assert.ok(a.get(IService1));
      assert.ok(a.get(IService2));
    });
  });
  test("SyncDesc - no dependencies", function() {
    const collection = new ServiceCollection();
    const service = new InstantiationService(collection);
    collection.set(IService1, new SyncDescriptor(Service1));
    service.invokeFunction((accessor) => {
      const service1 = accessor.get(IService1);
      assert.ok(service1);
      assert.strictEqual(service1.c, 1);
      const service2 = accessor.get(IService1);
      assert.ok(service1 === service2);
    });
  });
  test("SyncDesc - service with service dependency", function() {
    const collection = new ServiceCollection();
    const service = new InstantiationService(collection);
    collection.set(IService1, new SyncDescriptor(Service1));
    collection.set(IDependentService, new SyncDescriptor(DependentService));
    service.invokeFunction((accessor) => {
      const d = accessor.get(IDependentService);
      assert.ok(d);
      assert.strictEqual(d.name, "farboo");
    });
  });
  test("SyncDesc - target depends on service future", function() {
    const collection = new ServiceCollection();
    const service = new InstantiationService(collection);
    collection.set(IService1, new SyncDescriptor(Service1));
    collection.set(IDependentService, new SyncDescriptor(DependentService));
    const d = service.createInstance(DependentServiceTarget);
    assert.ok(d instanceof DependentServiceTarget);
    const d2 = service.createInstance(DependentServiceTarget2);
    assert.ok(d2 instanceof DependentServiceTarget2);
  });
  test("SyncDesc - explode on loop", function() {
    const collection = new ServiceCollection();
    const service = new InstantiationService(collection);
    collection.set(IService1, new SyncDescriptor(ServiceLoop1));
    collection.set(IService2, new SyncDescriptor(ServiceLoop2));
    assert.throws(() => {
      service.invokeFunction((accessor) => {
        accessor.get(IService1);
      });
    });
    assert.throws(() => {
      service.invokeFunction((accessor) => {
        accessor.get(IService2);
      });
    });
    try {
      service.invokeFunction((accessor) => {
        accessor.get(IService1);
      });
    } catch (err) {
      assert.ok(err.name);
      assert.ok(err.message);
    }
  });
  test("Invoke - get services", function() {
    const collection = new ServiceCollection();
    const service = new InstantiationService(collection);
    collection.set(IService1, new Service1());
    collection.set(IService2, new Service2());
    function test2(accessor) {
      assert.ok(accessor.get(IService1) instanceof Service1);
      assert.strictEqual(accessor.get(IService1).c, 1);
      return true;
    }
    assert.strictEqual(service.invokeFunction(test2), true);
  });
  test("Invoke - get service, optional", function() {
    const collection = new ServiceCollection([IService1, new Service1()]);
    const service = new InstantiationService(collection);
    function test2(accessor) {
      assert.ok(accessor.get(IService1) instanceof Service1);
      assert.throws(() => accessor.get(IService2));
      return true;
    }
    assert.strictEqual(service.invokeFunction(test2), true);
  });
  test("Invoke - keeping accessor NOT allowed", function() {
    const collection = new ServiceCollection();
    const service = new InstantiationService(collection);
    collection.set(IService1, new Service1());
    collection.set(IService2, new Service2());
    let cached;
    function test2(accessor) {
      assert.ok(accessor.get(IService1) instanceof Service1);
      assert.strictEqual(accessor.get(IService1).c, 1);
      cached = accessor;
      return true;
    }
    assert.strictEqual(service.invokeFunction(test2), true);
    assert.throws(() => cached.get(IService2));
  });
  test("Invoke - throw error", function() {
    const collection = new ServiceCollection();
    const service = new InstantiationService(collection);
    collection.set(IService1, new Service1());
    collection.set(IService2, new Service2());
    function test2(accessor) {
      throw new Error();
    }
    assert.throws(() => service.invokeFunction(test2));
  });
  test("Create child", function() {
    let serviceInstanceCount = 0;
    const CtorCounter = class {
      constructor() {
        this.c = 1;
        serviceInstanceCount += 1;
      }
    };
    let service = new InstantiationService(new ServiceCollection([IService1, new SyncDescriptor(CtorCounter)]));
    service.createInstance(Service1Consumer);
    let child = service.createChild(new ServiceCollection([IService2, new Service2()]));
    child.createInstance(Service1Consumer);
    assert.strictEqual(serviceInstanceCount, 1);
    serviceInstanceCount = 0;
    service = new InstantiationService(new ServiceCollection([IService1, new SyncDescriptor(CtorCounter)]));
    child = service.createChild(new ServiceCollection([IService2, new Service2()]));
    service.createInstance(Service1Consumer);
    child.createInstance(Service1Consumer);
    assert.strictEqual(serviceInstanceCount, 1);
  });
  test("Remote window / integration tests is broken #105562", function() {
    const Service12 = createDecorator("service1");
    let Service1Impl = class {
      constructor(insta2) {
        const c = insta2.invokeFunction((accessor) => accessor.get(Service22));
        assert.ok(c);
      }
    };
    Service1Impl = __decorateClass([
      __decorateParam(0, IInstantiationService)
    ], Service1Impl);
    const Service22 = createDecorator("service2");
    class Service2Impl {
      constructor() {
      }
    }
    const Service21 = createDecorator("service21");
    let Service21Impl = class {
      constructor(service2, service1) {
        this.service2 = service2;
        this.service1 = service1;
      }
    };
    Service21Impl = __decorateClass([
      __decorateParam(0, Service22),
      __decorateParam(1, Service12)
    ], Service21Impl);
    const insta = new InstantiationService(new ServiceCollection(
      [Service12, new SyncDescriptor(Service1Impl)],
      [Service22, new SyncDescriptor(Service2Impl)],
      [Service21, new SyncDescriptor(Service21Impl)]
    ));
    const obj = insta.invokeFunction((accessor) => accessor.get(Service21));
    assert.ok(obj);
  });
  test("Sync/Async dependency loop", async function() {
    const A = createDecorator("A");
    const B = createDecorator("B");
    let BConsumer = class {
      constructor(b) {
        this.b = b;
      }
      doIt() {
        return this.b.b();
      }
    };
    BConsumer = __decorateClass([
      __decorateParam(0, B)
    ], BConsumer);
    let AService = class {
      constructor(insta) {
        this.prop = insta.createInstance(BConsumer);
      }
      doIt() {
        return this.prop.doIt();
      }
    };
    AService = __decorateClass([
      __decorateParam(0, IInstantiationService)
    ], AService);
    let BService = class {
      constructor(a) {
        assert.ok(a);
      }
      b() {
        return true;
      }
    };
    BService = __decorateClass([
      __decorateParam(0, A)
    ], BService);
    {
      const insta1 = new InstantiationService(new ServiceCollection(
        [A, new SyncDescriptor(AService)],
        [B, new SyncDescriptor(BService)]
      ), true, void 0, true);
      try {
        insta1.invokeFunction((accessor) => accessor.get(A));
        assert.ok(false);
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes("RECURSIVELY"));
      }
    }
    {
      const insta2 = new InstantiationService(new ServiceCollection(
        [A, new SyncDescriptor(AService, void 0, true)],
        [B, new SyncDescriptor(BService, void 0)]
      ), true, void 0, true);
      const a = insta2.invokeFunction((accessor) => accessor.get(A));
      a.doIt();
      const cycle = insta2._globalGraph?.findCycleSlow();
      assert.strictEqual(cycle, "A -> B -> A");
    }
  });
  test("Delayed and events", function() {
    const A = createDecorator("A");
    let created = false;
    class AImpl {
      constructor() {
        this._doIt = 0;
        this._onDidDoIt = new Emitter();
        this.onDidDoIt = this._onDidDoIt.event;
        created = true;
      }
      doIt() {
        this._doIt += 1;
        this._onDidDoIt.fire(this);
      }
    }
    const insta = new InstantiationService(new ServiceCollection(
      [A, new SyncDescriptor(AImpl, void 0, true)]
    ), true, void 0, true);
    let Consumer = class {
      constructor(a) {
        this.a = a;
      }
    };
    Consumer = __decorateClass([
      __decorateParam(0, A)
    ], Consumer);
    const c = insta.createInstance(Consumer);
    let eventCount = 0;
    const listener = (e) => {
      assert.ok(e instanceof AImpl);
      eventCount++;
    };
    const d1 = c.a.onDidDoIt(listener);
    const d2 = c.a.onDidDoIt(listener);
    assert.strictEqual(created, false);
    assert.strictEqual(eventCount, 0);
    d2.dispose();
    c.a.doIt();
    assert.strictEqual(created, true);
    assert.strictEqual(eventCount, 1);
    const d3 = c.a.onDidDoIt(listener);
    c.a.doIt();
    assert.strictEqual(eventCount, 3);
    dispose([d1, d3]);
  });
  test("Capture event before init, use after init", function() {
    const A = createDecorator("A");
    let created = false;
    class AImpl {
      constructor() {
        this._doIt = 0;
        this._onDidDoIt = new Emitter();
        this.onDidDoIt = this._onDidDoIt.event;
        created = true;
      }
      doIt() {
        this._doIt += 1;
        this._onDidDoIt.fire(this);
      }
      noop() {
      }
    }
    const insta = new InstantiationService(new ServiceCollection(
      [A, new SyncDescriptor(AImpl, void 0, true)]
    ), true, void 0, true);
    let Consumer = class {
      constructor(a) {
        this.a = a;
      }
    };
    Consumer = __decorateClass([
      __decorateParam(0, A)
    ], Consumer);
    const c = insta.createInstance(Consumer);
    let eventCount = 0;
    const listener = (e) => {
      assert.ok(e instanceof AImpl);
      eventCount++;
    };
    const event = c.a.onDidDoIt;
    assert.strictEqual(created, false);
    c.a.noop();
    assert.strictEqual(created, true);
    const d1 = event(listener);
    c.a.doIt();
    assert.strictEqual(eventCount, 1);
    dispose(d1);
  });
  test("Dispose early event listener", function() {
    const A = createDecorator("A");
    let created = false;
    class AImpl {
      constructor() {
        this._doIt = 0;
        this._onDidDoIt = new Emitter();
        this.onDidDoIt = this._onDidDoIt.event;
        created = true;
      }
      doIt() {
        this._doIt += 1;
        this._onDidDoIt.fire(this);
      }
    }
    const insta = new InstantiationService(new ServiceCollection(
      [A, new SyncDescriptor(AImpl, void 0, true)]
    ), true, void 0, true);
    let Consumer = class {
      constructor(a) {
        this.a = a;
      }
    };
    Consumer = __decorateClass([
      __decorateParam(0, A)
    ], Consumer);
    const c = insta.createInstance(Consumer);
    let eventCount = 0;
    const listener = (e) => {
      assert.ok(e instanceof AImpl);
      eventCount++;
    };
    const d1 = c.a.onDidDoIt(listener);
    assert.strictEqual(created, false);
    assert.strictEqual(eventCount, 0);
    c.a.doIt();
    assert.strictEqual(created, true);
    assert.strictEqual(eventCount, 1);
    dispose(d1);
    c.a.doIt();
    assert.strictEqual(eventCount, 1);
  });
  test("Dispose services it created", function() {
    let disposedA = false;
    let disposedB = false;
    const A = createDecorator("A");
    class AImpl {
      constructor() {
        this.value = 1;
      }
      dispose() {
        disposedA = true;
      }
    }
    const B = createDecorator("B");
    class BImpl {
      constructor() {
        this.value = 1;
      }
      dispose() {
        disposedB = true;
      }
    }
    const insta = new InstantiationService(new ServiceCollection(
      [A, new SyncDescriptor(AImpl, void 0, true)],
      [B, new BImpl()]
    ), true, void 0, true);
    let Consumer = class {
      constructor(a, b) {
        this.a = a;
        this.b = b;
        assert.strictEqual(a.value, b.value);
      }
    };
    Consumer = __decorateClass([
      __decorateParam(0, A),
      __decorateParam(1, B)
    ], Consumer);
    const c = insta.createInstance(Consumer);
    insta.dispose();
    assert.ok(c);
    assert.strictEqual(disposedA, true);
    assert.strictEqual(disposedB, false);
  });
  test("Disposed service cannot be used anymore", function() {
    const B = createDecorator("B");
    class BImpl {
      constructor() {
        this.value = 1;
      }
    }
    const insta = new InstantiationService(new ServiceCollection(
      [B, new BImpl()]
    ), true, void 0, true);
    let Consumer = class {
      constructor(b) {
        this.b = b;
        assert.strictEqual(b.value, 1);
      }
    };
    Consumer = __decorateClass([
      __decorateParam(0, B)
    ], Consumer);
    const c = insta.createInstance(Consumer);
    assert.ok(c);
    insta.dispose();
    assert.throws(() => insta.createInstance(Consumer));
    assert.throws(() => insta.invokeFunction((accessor) => {
    }));
    assert.throws(() => insta.createChild(new ServiceCollection()));
  });
  test("Child does not dispose parent", function() {
    const B = createDecorator("B");
    class BImpl {
      constructor() {
        this.value = 1;
      }
    }
    const insta1 = new InstantiationService(new ServiceCollection(
      [B, new BImpl()]
    ), true, void 0, true);
    const insta2 = insta1.createChild(new ServiceCollection());
    let Consumer = class {
      constructor(b) {
        this.b = b;
        assert.strictEqual(b.value, 1);
      }
    };
    Consumer = __decorateClass([
      __decorateParam(0, B)
    ], Consumer);
    assert.ok(insta1.createInstance(Consumer));
    assert.ok(insta2.createInstance(Consumer));
    insta2.dispose();
    assert.ok(insta1.createInstance(Consumer));
    assert.throws(() => insta2.createInstance(Consumer));
  });
  test("Parent does dispose children", function() {
    const B = createDecorator("B");
    class BImpl {
      constructor() {
        this.value = 1;
      }
    }
    const insta1 = new InstantiationService(new ServiceCollection(
      [B, new BImpl()]
    ), true, void 0, true);
    const insta2 = insta1.createChild(new ServiceCollection());
    let Consumer = class {
      constructor(b) {
        this.b = b;
        assert.strictEqual(b.value, 1);
      }
    };
    Consumer = __decorateClass([
      __decorateParam(0, B)
    ], Consumer);
    assert.ok(insta1.createInstance(Consumer));
    assert.ok(insta2.createInstance(Consumer));
    insta1.dispose();
    assert.throws(() => insta2.createInstance(Consumer));
    assert.throws(() => insta1.createInstance(Consumer));
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGRpc3Bvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IsIElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcblxuY29uc3QgSVNlcnZpY2UxID0gY3JlYXRlRGVjb3JhdG9yPElTZXJ2aWNlMT4oJ3NlcnZpY2UxJyk7XG5cbmludGVyZmFjZSBJU2VydmljZTEge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGM6IG51bWJlcjtcbn1cblxuY2xhc3MgU2VydmljZTEgaW1wbGVtZW50cyBJU2VydmljZTEge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0YyA9IDE7XG59XG5cbmNvbnN0IElTZXJ2aWNlMiA9IGNyZWF0ZURlY29yYXRvcjxJU2VydmljZTI+KCdzZXJ2aWNlMicpO1xuXG5pbnRlcmZhY2UgSVNlcnZpY2UyIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRkOiBib29sZWFuO1xufVxuXG5jbGFzcyBTZXJ2aWNlMiBpbXBsZW1lbnRzIElTZXJ2aWNlMiB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRkID0gdHJ1ZTtcbn1cblxuY29uc3QgSVNlcnZpY2UzID0gY3JlYXRlRGVjb3JhdG9yPElTZXJ2aWNlMz4oJ3NlcnZpY2UzJyk7XG5cbmludGVyZmFjZSBJU2VydmljZTMge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHM6IHN0cmluZztcbn1cblxuY2xhc3MgU2VydmljZTMgaW1wbGVtZW50cyBJU2VydmljZTMge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cyA9ICdmYXJib28nO1xufVxuXG5jb25zdCBJRGVwZW5kZW50U2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJRGVwZW5kZW50U2VydmljZT4oJ2RlcGVuZGVudFNlcnZpY2UnKTtcblxuaW50ZXJmYWNlIElEZXBlbmRlbnRTZXJ2aWNlIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRuYW1lOiBzdHJpbmc7XG59XG5cbmNsYXNzIERlcGVuZGVudFNlcnZpY2UgaW1wbGVtZW50cyBJRGVwZW5kZW50U2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRjb25zdHJ1Y3RvcihASVNlcnZpY2UxIHNlcnZpY2U6IElTZXJ2aWNlMSkge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmMsIDEpO1xuXHR9XG5cblx0bmFtZSA9ICdmYXJib28nO1xufVxuXG5jbGFzcyBTZXJ2aWNlMUNvbnN1bWVyIHtcblxuXHRjb25zdHJ1Y3RvcihASVNlcnZpY2UxIHNlcnZpY2UxOiBJU2VydmljZTEpIHtcblx0XHRhc3NlcnQub2soc2VydmljZTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlMS5jLCAxKTtcblx0fVxufVxuXG5jbGFzcyBUYXJnZXQyRGVwIHtcblxuXHRjb25zdHJ1Y3RvcihASVNlcnZpY2UxIHNlcnZpY2UxOiBJU2VydmljZTEsIEBJU2VydmljZTIgc2VydmljZTI6IFNlcnZpY2UyKSB7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UxIGluc3RhbmNlb2YgU2VydmljZTEpO1xuXHRcdGFzc2VydC5vayhzZXJ2aWNlMiBpbnN0YW5jZW9mIFNlcnZpY2UyKTtcblx0fVxufVxuXG5jbGFzcyBUYXJnZXRXaXRoU3RhdGljUGFyYW0ge1xuXHRjb25zdHJ1Y3Rvcih2OiBib29sZWFuLCBASVNlcnZpY2UxIHNlcnZpY2UxOiBJU2VydmljZTEpIHtcblx0XHRhc3NlcnQub2sodik7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZTEuYywgMSk7XG5cdH1cbn1cblxuXG5cbmNsYXNzIERlcGVuZGVudFNlcnZpY2VUYXJnZXQge1xuXHRjb25zdHJ1Y3RvcihASURlcGVuZGVudFNlcnZpY2UgZDogSURlcGVuZGVudFNlcnZpY2UpIHtcblx0XHRhc3NlcnQub2soZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGQubmFtZSwgJ2ZhcmJvbycpO1xuXHR9XG59XG5cbmNsYXNzIERlcGVuZGVudFNlcnZpY2VUYXJnZXQyIHtcblx0Y29uc3RydWN0b3IoQElEZXBlbmRlbnRTZXJ2aWNlIGQ6IElEZXBlbmRlbnRTZXJ2aWNlLCBASVNlcnZpY2UxIHM6IElTZXJ2aWNlMSkge1xuXHRcdGFzc2VydC5vayhkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZC5uYW1lLCAnZmFyYm9vJyk7XG5cdFx0YXNzZXJ0Lm9rKHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzLmMsIDEpO1xuXHR9XG59XG5cblxuY2xhc3MgU2VydmljZUxvb3AxIGltcGxlbWVudHMgSVNlcnZpY2UxIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGMgPSAxO1xuXG5cdGNvbnN0cnVjdG9yKEBJU2VydmljZTIgczogSVNlcnZpY2UyKSB7XG5cblx0fVxufVxuXG5jbGFzcyBTZXJ2aWNlTG9vcDIgaW1wbGVtZW50cyBJU2VydmljZTIge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0ZCA9IHRydWU7XG5cblx0Y29uc3RydWN0b3IoQElTZXJ2aWNlMSBzOiBJU2VydmljZTEpIHtcblxuXHR9XG59XG5cbnN1aXRlKCdJbnN0YW50aWF0aW9uIFNlcnZpY2UnLCAoKSA9PiB7XG5cblx0dGVzdCgnc2VydmljZSBjb2xsZWN0aW9uLCBjYW5ub3Qgb3ZlcndyaXRlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblx0XHRsZXQgcmVzdWx0ID0gY29sbGVjdGlvbi5zZXQoSVNlcnZpY2UxLCBudWxsISk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgdW5kZWZpbmVkKTtcblx0XHRyZXN1bHQgPSBjb2xsZWN0aW9uLnNldChJU2VydmljZTEsIG5ldyBTZXJ2aWNlMSgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnc2VydmljZSBjb2xsZWN0aW9uLCBhZGQvaGFzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblx0XHRjb2xsZWN0aW9uLnNldChJU2VydmljZTEsIG51bGwhKTtcblx0XHRhc3NlcnQub2soY29sbGVjdGlvbi5oYXMoSVNlcnZpY2UxKSk7XG5cblx0XHRjb2xsZWN0aW9uLnNldChJU2VydmljZTIsIG51bGwhKTtcblx0XHRhc3NlcnQub2soY29sbGVjdGlvbi5oYXMoSVNlcnZpY2UxKSk7XG5cdFx0YXNzZXJ0Lm9rKGNvbGxlY3Rpb24uaGFzKElTZXJ2aWNlMikpO1xuXHR9KTtcblxuXHR0ZXN0KCdAUGFyYW0gLSBzaW1wbGUgY2xhc2UnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbigpO1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UoY29sbGVjdGlvbik7XG5cdFx0Y29sbGVjdGlvbi5zZXQoSVNlcnZpY2UxLCBuZXcgU2VydmljZTEoKSk7XG5cdFx0Y29sbGVjdGlvbi5zZXQoSVNlcnZpY2UyLCBuZXcgU2VydmljZTIoKSk7XG5cdFx0Y29sbGVjdGlvbi5zZXQoSVNlcnZpY2UzLCBuZXcgU2VydmljZTMoKSk7XG5cblx0XHRzZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlcnZpY2UxQ29uc3VtZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCdAUGFyYW0gLSBmaXhlZCBhcmdzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKGNvbGxlY3Rpb24pO1xuXHRcdGNvbGxlY3Rpb24uc2V0KElTZXJ2aWNlMSwgbmV3IFNlcnZpY2UxKCkpO1xuXHRcdGNvbGxlY3Rpb24uc2V0KElTZXJ2aWNlMiwgbmV3IFNlcnZpY2UyKCkpO1xuXHRcdGNvbGxlY3Rpb24uc2V0KElTZXJ2aWNlMywgbmV3IFNlcnZpY2UzKCkpO1xuXG5cdFx0c2VydmljZS5jcmVhdGVJbnN0YW5jZShUYXJnZXRXaXRoU3RhdGljUGFyYW0sIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXJ2aWNlIGNvbGxlY3Rpb24gaXMgbGl2ZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblx0XHRjb2xsZWN0aW9uLnNldChJU2VydmljZTEsIG5ldyBTZXJ2aWNlMSgpKTtcblxuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UoY29sbGVjdGlvbik7XG5cdFx0c2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXJ2aWNlMUNvbnN1bWVyKTtcblxuXHRcdGNvbGxlY3Rpb24uc2V0KElTZXJ2aWNlMiwgbmV3IFNlcnZpY2UyKCkpO1xuXG5cdFx0c2VydmljZS5jcmVhdGVJbnN0YW5jZShUYXJnZXQyRGVwKTtcblx0XHRzZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZ1bmN0aW9uIChhKSB7XG5cdFx0XHRhc3NlcnQub2soYS5nZXQoSVNlcnZpY2UxKSk7XG5cdFx0XHRhc3NlcnQub2soYS5nZXQoSVNlcnZpY2UyKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIHdlIG1hZGUgdGhpcyBhIHdhcm5pbmdcblx0Ly8gdGVzdCgnQFBhcmFtIC0gdG9vIG1hbnkgYXJncycsIGZ1bmN0aW9uICgpIHtcblx0Ly8gXHRsZXQgc2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZShPYmplY3QuY3JlYXRlKG51bGwpKTtcblx0Ly8gXHRzZXJ2aWNlLmFkZFNpbmdsZXRvbihJU2VydmljZTEsIG5ldyBTZXJ2aWNlMSgpKTtcblx0Ly8gXHRzZXJ2aWNlLmFkZFNpbmdsZXRvbihJU2VydmljZTIsIG5ldyBTZXJ2aWNlMigpKTtcblx0Ly8gXHRzZXJ2aWNlLmFkZFNpbmdsZXRvbihJU2VydmljZTMsIG5ldyBTZXJ2aWNlMygpKTtcblxuXHQvLyBcdGFzc2VydC50aHJvd3MoKCkgPT4gc2VydmljZS5jcmVhdGVJbnN0YW5jZShQYXJhbWV0ZXJUYXJnZXQyLCB0cnVlLCAyKSk7XG5cdC8vIH0pO1xuXG5cdC8vIHRlc3QoJ0BQYXJhbSAtIHRvbyBmZXcgYXJncycsIGZ1bmN0aW9uICgpIHtcblx0Ly8gXHRsZXQgc2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZShPYmplY3QuY3JlYXRlKG51bGwpKTtcblx0Ly8gXHRzZXJ2aWNlLmFkZFNpbmdsZXRvbihJU2VydmljZTEsIG5ldyBTZXJ2aWNlMSgpKTtcblx0Ly8gXHRzZXJ2aWNlLmFkZFNpbmdsZXRvbihJU2VydmljZTIsIG5ldyBTZXJ2aWNlMigpKTtcblx0Ly8gXHRzZXJ2aWNlLmFkZFNpbmdsZXRvbihJU2VydmljZTMsIG5ldyBTZXJ2aWNlMygpKTtcblxuXHQvLyBcdGFzc2VydC50aHJvd3MoKCkgPT4gc2VydmljZS5jcmVhdGVJbnN0YW5jZShQYXJhbWV0ZXJUYXJnZXQyKSk7XG5cdC8vIH0pO1xuXG5cdHRlc3QoJ1N5bmNEZXNjIC0gbm8gZGVwZW5kZW5jaWVzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKGNvbGxlY3Rpb24pO1xuXHRcdGNvbGxlY3Rpb24uc2V0KElTZXJ2aWNlMSwgbmV3IFN5bmNEZXNjcmlwdG9yPElTZXJ2aWNlMT4oU2VydmljZTEpKTtcblxuXHRcdHNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4ge1xuXG5cdFx0XHRjb25zdCBzZXJ2aWNlMSA9IGFjY2Vzc29yLmdldChJU2VydmljZTEpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlcnZpY2UxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlMS5jLCAxKTtcblxuXHRcdFx0Y29uc3Qgc2VydmljZTIgPSBhY2Nlc3Nvci5nZXQoSVNlcnZpY2UxKTtcblx0XHRcdGFzc2VydC5vayhzZXJ2aWNlMSA9PT0gc2VydmljZTIpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTeW5jRGVzYyAtIHNlcnZpY2Ugd2l0aCBzZXJ2aWNlIGRlcGVuZGVuY3knLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbigpO1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UoY29sbGVjdGlvbik7XG5cdFx0Y29sbGVjdGlvbi5zZXQoSVNlcnZpY2UxLCBuZXcgU3luY0Rlc2NyaXB0b3I8SVNlcnZpY2UxPihTZXJ2aWNlMSkpO1xuXHRcdGNvbGxlY3Rpb24uc2V0KElEZXBlbmRlbnRTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3I8SURlcGVuZGVudFNlcnZpY2U+KERlcGVuZGVudFNlcnZpY2UpKTtcblxuXHRcdHNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4ge1xuXHRcdFx0Y29uc3QgZCA9IGFjY2Vzc29yLmdldChJRGVwZW5kZW50U2VydmljZSk7XG5cdFx0XHRhc3NlcnQub2soZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZC5uYW1lLCAnZmFyYm9vJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N5bmNEZXNjIC0gdGFyZ2V0IGRlcGVuZHMgb24gc2VydmljZSBmdXR1cmUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbigpO1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UoY29sbGVjdGlvbik7XG5cdFx0Y29sbGVjdGlvbi5zZXQoSVNlcnZpY2UxLCBuZXcgU3luY0Rlc2NyaXB0b3I8SVNlcnZpY2UxPihTZXJ2aWNlMSkpO1xuXHRcdGNvbGxlY3Rpb24uc2V0KElEZXBlbmRlbnRTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3I8SURlcGVuZGVudFNlcnZpY2U+KERlcGVuZGVudFNlcnZpY2UpKTtcblxuXHRcdGNvbnN0IGQgPSBzZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlcGVuZGVudFNlcnZpY2VUYXJnZXQpO1xuXHRcdGFzc2VydC5vayhkIGluc3RhbmNlb2YgRGVwZW5kZW50U2VydmljZVRhcmdldCk7XG5cblx0XHRjb25zdCBkMiA9IHNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGVwZW5kZW50U2VydmljZVRhcmdldDIpO1xuXHRcdGFzc2VydC5vayhkMiBpbnN0YW5jZW9mIERlcGVuZGVudFNlcnZpY2VUYXJnZXQyKTtcblx0fSk7XG5cblx0dGVzdCgnU3luY0Rlc2MgLSBleHBsb2RlIG9uIGxvb3AnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbigpO1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UoY29sbGVjdGlvbik7XG5cdFx0Y29sbGVjdGlvbi5zZXQoSVNlcnZpY2UxLCBuZXcgU3luY0Rlc2NyaXB0b3I8SVNlcnZpY2UxPihTZXJ2aWNlTG9vcDEpKTtcblx0XHRjb2xsZWN0aW9uLnNldChJU2VydmljZTIsIG5ldyBTeW5jRGVzY3JpcHRvcjxJU2VydmljZTI+KFNlcnZpY2VMb29wMikpO1xuXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRzZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0YWNjZXNzb3IuZ2V0KElTZXJ2aWNlMSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdHNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRhY2Nlc3Nvci5nZXQoSVNlcnZpY2UyKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dHJ5IHtcblx0XHRcdHNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRhY2Nlc3Nvci5nZXQoSVNlcnZpY2UxKTtcblx0XHRcdH0pO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0YXNzZXJ0Lm9rKGVyci5uYW1lKTtcblx0XHRcdGFzc2VydC5vayhlcnIubWVzc2FnZSk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdJbnZva2UgLSBnZXQgc2VydmljZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbigpO1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UoY29sbGVjdGlvbik7XG5cdFx0Y29sbGVjdGlvbi5zZXQoSVNlcnZpY2UxLCBuZXcgU2VydmljZTEoKSk7XG5cdFx0Y29sbGVjdGlvbi5zZXQoSVNlcnZpY2UyLCBuZXcgU2VydmljZTIoKSk7XG5cblx0XHRmdW5jdGlvbiB0ZXN0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRhc3NlcnQub2soYWNjZXNzb3IuZ2V0KElTZXJ2aWNlMSkgaW5zdGFuY2VvZiBTZXJ2aWNlMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3IuZ2V0KElTZXJ2aWNlMSkuYywgMSk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHRlc3QpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnSW52b2tlIC0gZ2V0IHNlcnZpY2UsIG9wdGlvbmFsJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lTZXJ2aWNlMSwgbmV3IFNlcnZpY2UxKCldKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKGNvbGxlY3Rpb24pO1xuXG5cdFx0ZnVuY3Rpb24gdGVzdChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdFx0YXNzZXJ0Lm9rKGFjY2Vzc29yLmdldChJU2VydmljZTEpIGluc3RhbmNlb2YgU2VydmljZTEpO1xuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiBhY2Nlc3Nvci5nZXQoSVNlcnZpY2UyKSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaW52b2tlRnVuY3Rpb24odGVzdCksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnZva2UgLSBrZWVwaW5nIGFjY2Vzc29yIE5PVCBhbGxvd2VkJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKGNvbGxlY3Rpb24pO1xuXHRcdGNvbGxlY3Rpb24uc2V0KElTZXJ2aWNlMSwgbmV3IFNlcnZpY2UxKCkpO1xuXHRcdGNvbGxlY3Rpb24uc2V0KElTZXJ2aWNlMiwgbmV3IFNlcnZpY2UyKCkpO1xuXG5cdFx0bGV0IGNhY2hlZDogU2VydmljZXNBY2Nlc3NvcjtcblxuXHRcdGZ1bmN0aW9uIHRlc3QoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRcdGFzc2VydC5vayhhY2Nlc3Nvci5nZXQoSVNlcnZpY2UxKSBpbnN0YW5jZW9mIFNlcnZpY2UxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci5nZXQoSVNlcnZpY2UxKS5jLCAxKTtcblx0XHRcdGNhY2hlZCA9IGFjY2Vzc29yO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaW52b2tlRnVuY3Rpb24odGVzdCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBjYWNoZWQuZ2V0KElTZXJ2aWNlMikpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnZva2UgLSB0aHJvdyBlcnJvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBjb2xsZWN0aW9uID0gbmV3IFNlcnZpY2VDb2xsZWN0aW9uKCk7XG5cdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBJbnN0YW50aWF0aW9uU2VydmljZShjb2xsZWN0aW9uKTtcblx0XHRjb2xsZWN0aW9uLnNldChJU2VydmljZTEsIG5ldyBTZXJ2aWNlMSgpKTtcblx0XHRjb2xsZWN0aW9uLnNldChJU2VydmljZTIsIG5ldyBTZXJ2aWNlMigpKTtcblxuXHRcdGZ1bmN0aW9uIHRlc3QoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHRcdH1cblxuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gc2VydmljZS5pbnZva2VGdW5jdGlvbih0ZXN0KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NyZWF0ZSBjaGlsZCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCBzZXJ2aWNlSW5zdGFuY2VDb3VudCA9IDA7XG5cblx0XHRjb25zdCBDdG9yQ291bnRlciA9IGNsYXNzIGltcGxlbWVudHMgU2VydmljZTEge1xuXHRcdFx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdFx0XHRjID0gMTtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzZXJ2aWNlSW5zdGFuY2VDb3VudCArPSAxO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBjcmVhdGluZyB0aGUgc2VydmljZSBpbnN0YW5jZSBCRUZPUkUgdGhlIGNoaWxkIHNlcnZpY2Vcblx0XHRsZXQgc2VydmljZSA9IG5ldyBJbnN0YW50aWF0aW9uU2VydmljZShuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lTZXJ2aWNlMSwgbmV3IFN5bmNEZXNjcmlwdG9yKEN0b3JDb3VudGVyKV0pKTtcblx0XHRzZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlcnZpY2UxQ29uc3VtZXIpO1xuXG5cdFx0Ly8gc2Vjb25kIGluc3RhbmNlIG11c3QgYmUgZWFybGllciBPTkVcblx0XHRsZXQgY2hpbGQgPSBzZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSVNlcnZpY2UyLCBuZXcgU2VydmljZTIoKV0pKTtcblx0XHRjaGlsZC5jcmVhdGVJbnN0YW5jZShTZXJ2aWNlMUNvbnN1bWVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlSW5zdGFuY2VDb3VudCwgMSk7XG5cblx0XHQvLyBjcmVhdGluZyB0aGUgc2VydmljZSBpbnN0YW5jZSBBRlRFUiB0aGUgY2hpbGQgc2VydmljZVxuXHRcdHNlcnZpY2VJbnN0YW5jZUNvdW50ID0gMDtcblx0XHRzZXJ2aWNlID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSVNlcnZpY2UxLCBuZXcgU3luY0Rlc2NyaXB0b3IoQ3RvckNvdW50ZXIpXSkpO1xuXHRcdGNoaWxkID0gc2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lTZXJ2aWNlMiwgbmV3IFNlcnZpY2UyKCldKSk7XG5cblx0XHQvLyBzZWNvbmQgaW5zdGFuY2UgbXVzdCBiZSBlYXJsaWVyIE9ORVxuXHRcdHNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2VydmljZTFDb25zdW1lcik7XG5cdFx0Y2hpbGQuY3JlYXRlSW5zdGFuY2UoU2VydmljZTFDb25zdW1lcik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZUluc3RhbmNlQ291bnQsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdSZW1vdGUgd2luZG93IC8gaW50ZWdyYXRpb24gdGVzdHMgaXMgYnJva2VuICMxMDU1NjInLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBTZXJ2aWNlMSA9IGNyZWF0ZURlY29yYXRvcjxhbnk+KCdzZXJ2aWNlMScpO1xuXHRcdGNsYXNzIFNlcnZpY2UxSW1wbCB7XG5cdFx0XHRjb25zdHJ1Y3RvcihASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpIHtcblx0XHRcdFx0Y29uc3QgYyA9IGluc3RhLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGFjY2Vzc29yLmdldChTZXJ2aWNlMikpOyAvLyBUSElTIGlzIHRoZSByZWN1cnNpdmUgY2FsbFxuXHRcdFx0XHRhc3NlcnQub2soYyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IFNlcnZpY2UyID0gY3JlYXRlRGVjb3JhdG9yPGFueT4oJ3NlcnZpY2UyJyk7XG5cdFx0Y2xhc3MgU2VydmljZTJJbXBsIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkgeyB9XG5cdFx0fVxuXG5cdFx0Ly8gVGhpcyBzZXJ2aWNlIGRlcGVuZHMgb24gU2VydmljZTEgYW5kIFNlcnZpY2UyIEJVVCBjcmVhdGluZyBTZXJ2aWNlMSBjcmVhdGVzIFNlcnZpY2UyICh2aWEgcmVjdXJzaXZlIGludm9jYXRpb24pXG5cdFx0Ly8gYW5kIHRoZW4gU2VydmNlMiBzaG91bGQgbm90IGJlIGNyZWF0ZWQgYSBzZWNvbmQgdGltZVxuXHRcdGNvbnN0IFNlcnZpY2UyMSA9IGNyZWF0ZURlY29yYXRvcjxhbnk+KCdzZXJ2aWNlMjEnKTtcblx0XHRjbGFzcyBTZXJ2aWNlMjFJbXBsIHtcblx0XHRcdGNvbnN0cnVjdG9yKEBTZXJ2aWNlMiBwdWJsaWMgcmVhZG9ubHkgc2VydmljZTI6IFNlcnZpY2UySW1wbCwgQFNlcnZpY2UxIHB1YmxpYyByZWFkb25seSBzZXJ2aWNlMTogU2VydmljZTFJbXBsKSB7IH1cblx0XHR9XG5cblx0XHRjb25zdCBpbnN0YSA9IG5ldyBJbnN0YW50aWF0aW9uU2VydmljZShuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbU2VydmljZTEsIG5ldyBTeW5jRGVzY3JpcHRvcihTZXJ2aWNlMUltcGwpXSxcblx0XHRcdFtTZXJ2aWNlMiwgbmV3IFN5bmNEZXNjcmlwdG9yKFNlcnZpY2UySW1wbCldLFxuXHRcdFx0W1NlcnZpY2UyMSwgbmV3IFN5bmNEZXNjcmlwdG9yKFNlcnZpY2UyMUltcGwpXSxcblx0XHQpKTtcblxuXHRcdGNvbnN0IG9iaiA9IGluc3RhLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGFjY2Vzc29yLmdldChTZXJ2aWNlMjEpKTtcblx0XHRhc3NlcnQub2sob2JqKTtcblx0fSk7XG5cblx0dGVzdCgnU3luYy9Bc3luYyBkZXBlbmRlbmN5IGxvb3AnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBBID0gY3JlYXRlRGVjb3JhdG9yPEE+KCdBJyk7XG5cdFx0Y29uc3QgQiA9IGNyZWF0ZURlY29yYXRvcjxCPignQicpO1xuXHRcdGludGVyZmFjZSBBIHsgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkOyBkb0l0KCk6IHZvaWQgfVxuXHRcdGludGVyZmFjZSBCIHsgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkOyBiKCk6IGJvb2xlYW4gfVxuXG5cdFx0Y2xhc3MgQkNvbnN1bWVyIHtcblx0XHRcdGNvbnN0cnVjdG9yKEBCIHByaXZhdGUgcmVhZG9ubHkgYjogQikge1xuXG5cdFx0XHR9XG5cdFx0XHRkb0l0KCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5iLmIoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjbGFzcyBBU2VydmljZSBpbXBsZW1lbnRzIEEge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0cHJvcDogQkNvbnN1bWVyO1xuXHRcdFx0Y29uc3RydWN0b3IoQElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKSB7XG5cdFx0XHRcdHRoaXMucHJvcCA9IGluc3RhLmNyZWF0ZUluc3RhbmNlKEJDb25zdW1lcik7XG5cdFx0XHR9XG5cdFx0XHRkb0l0KCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5wcm9wLmRvSXQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjbGFzcyBCU2VydmljZSBpbXBsZW1lbnRzIEIge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3RydWN0b3IoQEEgYTogQSkge1xuXHRcdFx0XHRhc3NlcnQub2soYSk7XG5cdFx0XHR9XG5cdFx0XHRiKCkgeyByZXR1cm4gdHJ1ZTsgfVxuXHRcdH1cblxuXHRcdC8vIFNZTkMgLT4gZXhwbG9kZXMgQUltcGwgLT4gW2luc3RhOkJDb25zdW1lcl0gLT4gQkltcGwgLT4gQUltcGxcblx0XHR7XG5cdFx0XHRjb25zdCBpbnN0YTEgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0XHRbQSwgbmV3IFN5bmNEZXNjcmlwdG9yKEFTZXJ2aWNlKV0sXG5cdFx0XHRcdFtCLCBuZXcgU3luY0Rlc2NyaXB0b3IoQlNlcnZpY2UpXSxcblx0XHRcdCksIHRydWUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGluc3RhMS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBhY2Nlc3Nvci5nZXQoQSkpO1xuXHRcdFx0XHRhc3NlcnQub2soZmFsc2UpO1xuXG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRhc3NlcnQub2soZXJyb3IgaW5zdGFuY2VvZiBFcnJvcik7XG5cdFx0XHRcdGFzc2VydC5vayhlcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdSRUNVUlNJVkVMWScpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBU1lOQyAtPiBkb2Vzbid0IGV4cGxvZGUgYnV0IGN5Y2xlIGlzIHRyYWNrZWRcblx0XHR7XG5cdFx0XHRjb25zdCBpbnN0YTIgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0XHRbQSwgbmV3IFN5bmNEZXNjcmlwdG9yKEFTZXJ2aWNlLCB1bmRlZmluZWQsIHRydWUpXSxcblx0XHRcdFx0W0IsIG5ldyBTeW5jRGVzY3JpcHRvcihCU2VydmljZSwgdW5kZWZpbmVkKV0sXG5cdFx0XHQpLCB0cnVlLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRjb25zdCBhID0gaW5zdGEyLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGFjY2Vzc29yLmdldChBKSk7XG5cdFx0XHRhLmRvSXQoKTtcblxuXHRcdFx0Y29uc3QgY3ljbGUgPSBpbnN0YTIuX2dsb2JhbEdyYXBoPy5maW5kQ3ljbGVTbG93KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3ljbGUsICdBIC0+IEIgLT4gQScpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnRGVsYXllZCBhbmQgZXZlbnRzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IEEgPSBjcmVhdGVEZWNvcmF0b3I8QT4oJ0EnKTtcblx0XHRpbnRlcmZhY2UgQSB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdFx0XHRvbkRpZERvSXQ6IEV2ZW50PGFueT47XG5cdFx0XHRkb0l0KCk6IHZvaWQ7XG5cdFx0fVxuXG5cdFx0bGV0IGNyZWF0ZWQgPSBmYWxzZTtcblx0XHRjbGFzcyBBSW1wbCBpbXBsZW1lbnRzIEEge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0X2RvSXQgPSAwO1xuXG5cdFx0XHRfb25EaWREb0l0ID0gbmV3IEVtaXR0ZXI8dGhpcz4oKTtcblx0XHRcdG9uRGlkRG9JdDogRXZlbnQ8dGhpcz4gPSB0aGlzLl9vbkRpZERvSXQuZXZlbnQ7XG5cblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRjcmVhdGVkID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0ZG9JdCgpOiB2b2lkIHtcblx0XHRcdFx0dGhpcy5fZG9JdCArPSAxO1xuXHRcdFx0XHR0aGlzLl9vbkRpZERvSXQuZmlyZSh0aGlzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBpbnN0YSA9IG5ldyBJbnN0YW50aWF0aW9uU2VydmljZShuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbQSwgbmV3IFN5bmNEZXNjcmlwdG9yKEFJbXBsLCB1bmRlZmluZWQsIHRydWUpXSxcblx0XHQpLCB0cnVlLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0Y2xhc3MgQ29uc3VtZXIge1xuXHRcdFx0Y29uc3RydWN0b3IoQEEgcHVibGljIHJlYWRvbmx5IGE6IEEpIHtcblx0XHRcdFx0Ly8gZWFnZXIgc3Vic2NyaWJlIC0+IE5PIHNlcnZpY2UgaW5zdGFuY2Vcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjOiBDb25zdW1lciA9IGluc3RhLmNyZWF0ZUluc3RhbmNlKENvbnN1bWVyKTtcblx0XHRsZXQgZXZlbnRDb3VudCA9IDA7XG5cblx0XHQvLyBzdWJzY3JpYmluZyB0byBldmVudCBkb2Vzbid0IHRyaWdnZXIgaW5zdGFudGlhdGlvblxuXHRcdGNvbnN0IGxpc3RlbmVyID0gKGU6IGFueSkgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKGUgaW5zdGFuY2VvZiBBSW1wbCk7XG5cdFx0XHRldmVudENvdW50Kys7XG5cdFx0fTtcblx0XHRjb25zdCBkMSA9IGMuYS5vbkRpZERvSXQobGlzdGVuZXIpO1xuXHRcdGNvbnN0IGQyID0gYy5hLm9uRGlkRG9JdChsaXN0ZW5lcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMCk7XG5cdFx0ZDIuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gaW5zdGFudGlhdGlvbiBoYXBwZW5zIG9uIGZpcnN0IGNhbGxcblx0XHRjLmEuZG9JdCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMSk7XG5cblxuXHRcdGNvbnN0IGQzID0gYy5hLm9uRGlkRG9JdChsaXN0ZW5lcik7XG5cdFx0Yy5hLmRvSXQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMyk7XG5cblx0XHRkaXNwb3NlKFtkMSwgZDNdKTtcblx0fSk7XG5cblxuXHR0ZXN0KCdDYXB0dXJlIGV2ZW50IGJlZm9yZSBpbml0LCB1c2UgYWZ0ZXIgaW5pdCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBBID0gY3JlYXRlRGVjb3JhdG9yPEE+KCdBJyk7XG5cdFx0aW50ZXJmYWNlIEEge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0b25EaWREb0l0OiBFdmVudDxhbnk+O1xuXHRcdFx0ZG9JdCgpOiB2b2lkO1xuXHRcdFx0bm9vcCgpOiB2b2lkO1xuXHRcdH1cblxuXHRcdGxldCBjcmVhdGVkID0gZmFsc2U7XG5cdFx0Y2xhc3MgQUltcGwgaW1wbGVtZW50cyBBIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0XHRcdF9kb0l0ID0gMDtcblxuXHRcdFx0X29uRGlkRG9JdCA9IG5ldyBFbWl0dGVyPHRoaXM+KCk7XG5cdFx0XHRvbkRpZERvSXQ6IEV2ZW50PHRoaXM+ID0gdGhpcy5fb25EaWREb0l0LmV2ZW50O1xuXG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0Y3JlYXRlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGRvSXQoKTogdm9pZCB7XG5cdFx0XHRcdHRoaXMuX2RvSXQgKz0gMTtcblx0XHRcdFx0dGhpcy5fb25EaWREb0l0LmZpcmUodGhpcyk7XG5cdFx0XHR9XG5cblx0XHRcdG5vb3AoKTogdm9pZCB7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5zdGEgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0EsIG5ldyBTeW5jRGVzY3JpcHRvcihBSW1wbCwgdW5kZWZpbmVkLCB0cnVlKV0sXG5cdFx0KSwgdHJ1ZSwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdGNsYXNzIENvbnN1bWVyIHtcblx0XHRcdGNvbnN0cnVjdG9yKEBBIHB1YmxpYyByZWFkb25seSBhOiBBKSB7XG5cdFx0XHRcdC8vIGVhZ2VyIHN1YnNjcmliZSAtPiBOTyBzZXJ2aWNlIGluc3RhbmNlXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgYzogQ29uc3VtZXIgPSBpbnN0YS5jcmVhdGVJbnN0YW5jZShDb25zdW1lcik7XG5cdFx0bGV0IGV2ZW50Q291bnQgPSAwO1xuXG5cdFx0Ly8gc3Vic2NyaWJpbmcgdG8gZXZlbnQgZG9lc24ndCB0cmlnZ2VyIGluc3RhbnRpYXRpb25cblx0XHRjb25zdCBsaXN0ZW5lciA9IChlOiBhbnkpID0+IHtcblx0XHRcdGFzc2VydC5vayhlIGluc3RhbmNlb2YgQUltcGwpO1xuXHRcdFx0ZXZlbnRDb3VudCsrO1xuXHRcdH07XG5cblx0XHRjb25zdCBldmVudCA9IGMuYS5vbkRpZERvSXQ7XG5cblx0XHQvLyBjb25zdCBkMSA9IGMuYS5vbkRpZERvSXQobGlzdGVuZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVkLCBmYWxzZSk7XG5cblx0XHRjLmEubm9vcCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVkLCB0cnVlKTtcblxuXHRcdGNvbnN0IGQxID0gZXZlbnQobGlzdGVuZXIpO1xuXG5cdFx0Yy5hLmRvSXQoKTtcblxuXG5cdFx0Ly8gaW5zdGFudGlhdGlvbiBoYXBwZW5zIG9uIGZpcnN0IGNhbGxcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMSk7XG5cblx0XHRkaXNwb3NlKGQxKTtcblx0fSk7XG5cblx0dGVzdCgnRGlzcG9zZSBlYXJseSBldmVudCBsaXN0ZW5lcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBBID0gY3JlYXRlRGVjb3JhdG9yPEE+KCdBJyk7XG5cdFx0aW50ZXJmYWNlIEEge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0b25EaWREb0l0OiBFdmVudDxhbnk+O1xuXHRcdFx0ZG9JdCgpOiB2b2lkO1xuXHRcdH1cblx0XHRsZXQgY3JlYXRlZCA9IGZhbHNlO1xuXHRcdGNsYXNzIEFJbXBsIGltcGxlbWVudHMgQSB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdFx0XHRfZG9JdCA9IDA7XG5cblx0XHRcdF9vbkRpZERvSXQgPSBuZXcgRW1pdHRlcjx0aGlzPigpO1xuXHRcdFx0b25EaWREb0l0OiBFdmVudDx0aGlzPiA9IHRoaXMuX29uRGlkRG9JdC5ldmVudDtcblxuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdGNyZWF0ZWQgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRkb0l0KCk6IHZvaWQge1xuXHRcdFx0XHR0aGlzLl9kb0l0ICs9IDE7XG5cdFx0XHRcdHRoaXMuX29uRGlkRG9JdC5maXJlKHRoaXMpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGluc3RhID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRcdFtBLCBuZXcgU3luY0Rlc2NyaXB0b3IoQUltcGwsIHVuZGVmaW5lZCwgdHJ1ZSldLFxuXHRcdCksIHRydWUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRjbGFzcyBDb25zdW1lciB7XG5cdFx0XHRjb25zdHJ1Y3RvcihAQSBwdWJsaWMgcmVhZG9ubHkgYTogQSkge1xuXHRcdFx0XHQvLyBlYWdlciBzdWJzY3JpYmUgLT4gTk8gc2VydmljZSBpbnN0YW5jZVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGM6IENvbnN1bWVyID0gaW5zdGEuY3JlYXRlSW5zdGFuY2UoQ29uc3VtZXIpO1xuXHRcdGxldCBldmVudENvdW50ID0gMDtcblxuXHRcdC8vIHN1YnNjcmliaW5nIHRvIGV2ZW50IGRvZXNuJ3QgdHJpZ2dlciBpbnN0YW50aWF0aW9uXG5cdFx0Y29uc3QgbGlzdGVuZXIgPSAoZTogYW55KSA9PiB7XG5cdFx0XHRhc3NlcnQub2soZSBpbnN0YW5jZW9mIEFJbXBsKTtcblx0XHRcdGV2ZW50Q291bnQrKztcblx0XHR9O1xuXG5cdFx0Y29uc3QgZDEgPSBjLmEub25EaWREb0l0KGxpc3RlbmVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50LCAwKTtcblxuXHRcdGMuYS5kb0l0KCk7XG5cblx0XHQvLyBpbnN0YW50aWF0aW9uIGhhcHBlbnMgb24gZmlyc3QgY2FsbFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudCwgMSk7XG5cblx0XHRkaXNwb3NlKGQxKTtcblxuXHRcdGMuYS5kb0l0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnQsIDEpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0Rpc3Bvc2Ugc2VydmljZXMgaXQgY3JlYXRlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgZGlzcG9zZWRBID0gZmFsc2U7XG5cdFx0bGV0IGRpc3Bvc2VkQiA9IGZhbHNlO1xuXG5cdFx0Y29uc3QgQSA9IGNyZWF0ZURlY29yYXRvcjxBPignQScpO1xuXHRcdGludGVyZmFjZSBBIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0XHRcdHZhbHVlOiAxO1xuXHRcdH1cblx0XHRjbGFzcyBBSW1wbCBpbXBsZW1lbnRzIEEge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0dmFsdWU6IDEgPSAxO1xuXHRcdFx0ZGlzcG9zZSgpIHtcblx0XHRcdFx0ZGlzcG9zZWRBID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBCID0gY3JlYXRlRGVjb3JhdG9yPEI+KCdCJyk7XG5cdFx0aW50ZXJmYWNlIEIge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0dmFsdWU6IDE7XG5cdFx0fVxuXHRcdGNsYXNzIEJJbXBsIGltcGxlbWVudHMgQiB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdFx0XHR2YWx1ZTogMSA9IDE7XG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHRkaXNwb3NlZEIgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGluc3RhID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRcdFtBLCBuZXcgU3luY0Rlc2NyaXB0b3IoQUltcGwsIHVuZGVmaW5lZCwgdHJ1ZSldLFxuXHRcdFx0W0IsIG5ldyBCSW1wbCgpXSxcblx0XHQpLCB0cnVlLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0Y2xhc3MgQ29uc3VtZXIge1xuXHRcdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRcdEBBIHB1YmxpYyByZWFkb25seSBhOiBBLFxuXHRcdFx0XHRAQiBwdWJsaWMgcmVhZG9ubHkgYjogQlxuXHRcdFx0KSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnZhbHVlLCBiLnZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjOiBDb25zdW1lciA9IGluc3RhLmNyZWF0ZUluc3RhbmNlKENvbnN1bWVyKTtcblxuXHRcdGluc3RhLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQub2soYyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VkQSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VkQiwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdEaXNwb3NlZCBzZXJ2aWNlIGNhbm5vdCBiZSB1c2VkIGFueW1vcmUnLCBmdW5jdGlvbiAoKSB7XG5cblxuXHRcdGNvbnN0IEIgPSBjcmVhdGVEZWNvcmF0b3I8Qj4oJ0InKTtcblx0XHRpbnRlcmZhY2UgQiB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdFx0XHR2YWx1ZTogMTtcblx0XHR9XG5cdFx0Y2xhc3MgQkltcGwgaW1wbGVtZW50cyBCIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0XHRcdHZhbHVlOiAxID0gMTtcblx0XHR9XG5cblx0XHRjb25zdCBpbnN0YSA9IG5ldyBJbnN0YW50aWF0aW9uU2VydmljZShuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbQiwgbmV3IEJJbXBsKCldLFxuXHRcdCksIHRydWUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRjbGFzcyBDb25zdW1lciB7XG5cdFx0XHRjb25zdHJ1Y3Rvcihcblx0XHRcdFx0QEIgcHVibGljIHJlYWRvbmx5IGI6IEJcblx0XHRcdCkge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi52YWx1ZSwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgYzogQ29uc3VtZXIgPSBpbnN0YS5jcmVhdGVJbnN0YW5jZShDb25zdW1lcik7XG5cdFx0YXNzZXJ0Lm9rKGMpO1xuXG5cdFx0aW5zdGEuZGlzcG9zZSgpO1xuXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBpbnN0YS5jcmVhdGVJbnN0YW5jZShDb25zdW1lcikpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gaW5zdGEuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4geyB9KSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBpbnN0YS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdDaGlsZCBkb2VzIG5vdCBkaXNwb3NlIHBhcmVudCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IEIgPSBjcmVhdGVEZWNvcmF0b3I8Qj4oJ0InKTtcblx0XHRpbnRlcmZhY2UgQiB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdFx0XHR2YWx1ZTogMTtcblx0XHR9XG5cdFx0Y2xhc3MgQkltcGwgaW1wbGVtZW50cyBCIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0XHRcdHZhbHVlOiAxID0gMTtcblx0XHR9XG5cblx0XHRjb25zdCBpbnN0YTEgPSBuZXcgSW5zdGFudGlhdGlvblNlcnZpY2UobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0IsIG5ldyBCSW1wbCgpXSxcblx0XHQpLCB0cnVlLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0Y29uc3QgaW5zdGEyID0gaW5zdGExLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbigpKTtcblxuXHRcdGNsYXNzIENvbnN1bWVyIHtcblx0XHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0XHRAQiBwdWJsaWMgcmVhZG9ubHkgYjogQlxuXHRcdFx0KSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnZhbHVlLCAxKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRhc3NlcnQub2soaW5zdGExLmNyZWF0ZUluc3RhbmNlKENvbnN1bWVyKSk7XG5cdFx0YXNzZXJ0Lm9rKGluc3RhMi5jcmVhdGVJbnN0YW5jZShDb25zdW1lcikpO1xuXG5cdFx0aW5zdGEyLmRpc3Bvc2UoKTtcblxuXHRcdGFzc2VydC5vayhpbnN0YTEuY3JlYXRlSW5zdGFuY2UoQ29uc3VtZXIpKTsgLy8gcGFyZW50IE5PVCBkaXNwb3NlZCBieSBjaGlsZFxuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gaW5zdGEyLmNyZWF0ZUluc3RhbmNlKENvbnN1bWVyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1BhcmVudCBkb2VzIGRpc3Bvc2UgY2hpbGRyZW4nLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBCID0gY3JlYXRlRGVjb3JhdG9yPEI+KCdCJyk7XG5cdFx0aW50ZXJmYWNlIEIge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0dmFsdWU6IDE7XG5cdFx0fVxuXHRcdGNsYXNzIEJJbXBsIGltcGxlbWVudHMgQiB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdFx0XHR2YWx1ZTogMSA9IDE7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5zdGExID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRcdFtCLCBuZXcgQkltcGwoKV0sXG5cdFx0KSwgdHJ1ZSwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdGNvbnN0IGluc3RhMiA9IGluc3RhMS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oKSk7XG5cblx0XHRjbGFzcyBDb25zdW1lciB7XG5cdFx0XHRjb25zdHJ1Y3Rvcihcblx0XHRcdFx0QEIgcHVibGljIHJlYWRvbmx5IGI6IEJcblx0XHRcdCkge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi52YWx1ZSwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXNzZXJ0Lm9rKGluc3RhMS5jcmVhdGVJbnN0YW5jZShDb25zdW1lcikpO1xuXHRcdGFzc2VydC5vayhpbnN0YTIuY3JlYXRlSW5zdGFuY2UoQ29uc3VtZXIpKTtcblxuXHRcdGluc3RhMS5kaXNwb3NlKCk7XG5cblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGluc3RhMi5jcmVhdGVJbnN0YW5jZShDb25zdW1lcikpOyAvLyBjaGlsZCBpcyBkaXNwb3NlZCBieSBwYXJlbnRcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGluc3RhMS5jcmVhdGVJbnN0YW5jZShDb25zdW1lcikpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xu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QUFBLElBS2hDLE1BQU0sTUFBbUI7QUFBQSxNQUF6QjtBQUVDLHFCQUFXO0FBQUE7QUFBQSxJQUNaO0FBRUEsVUFBTSxTQUFTLElBQUkscUJBQXFCLElBQUk7QUFBQSxNQUMzQyxDQUFDLEdBQUcsSUFBSSxNQUFNLENBQUM7QUFBQSxJQUNoQixHQUFHLE1BQU0sUUFBVyxJQUFJO0FBRXhCLFVBQU0sU0FBUyxPQUFPLFlBQVksSUFBSSxrQkFBa0IsQ0FBQztBQUV6RCxRQUFNLFdBQU4sTUFBZTtBQUFBLE1BQ2QsWUFDb0IsR0FDbEI7QUFEa0I7QUFFbkIsZUFBTyxZQUFZLEVBQUUsT0FBTyxDQUFDO0FBQUEsTUFDOUI7QUFBQSxJQUNEO0FBTk0sZUFBTjtBQUFBLE1BRUc7QUFBQSxPQUZHO0FBUU4sV0FBTyxHQUFHLE9BQU8sZUFBZSxRQUFRLENBQUM7QUFDekMsV0FBTyxHQUFHLE9BQU8sZUFBZSxRQUFRLENBQUM7QUFFekMsV0FBTyxRQUFRO0FBRWYsV0FBTyxPQUFPLE1BQU0sT0FBTyxlQUFlLFFBQVEsQ0FBQztBQUNuRCxXQUFPLE9BQU8sTUFBTSxPQUFPLGVBQWUsUUFBUSxDQUFDO0FBQUEsRUFDcEQsQ0FBQztBQUVELDBDQUF3QztBQUN6QyxDQUFDOyIsCiAgIm5hbWVzIjogWyJ0ZXN0IiwgIlNlcnZpY2UxIiwgImluc3RhIiwgIlNlcnZpY2UyIl0KfQo=
