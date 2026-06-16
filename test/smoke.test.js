import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import plugin from '../index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCmd(name) {
  const opts = [];
  const commands = [];

  const cmd = {
    _name: name,
    name: () => name,
    commands,
    description: () => cmd,
    requiredOption: (flags) => { opts.push(flags); return cmd; },
    option: (flags) => { opts.push(flags); return cmd; },
    addHelpText: () => cmd,
    action: () => cmd,
    command: (subName) => {
      const sub = makeCmd(subName);
      commands.push(sub);
      return sub;
    },
    _opts: opts,
  };
  return cmd;
}

function makeContext(profileType = 'magento-os') {
  const commands = [];

  const program = {
    commands,
    command: (name) => {
      const cmd = makeCmd(name);
      commands.push(cmd);
      return cmd;
    },
  };

  return {
    program,
    profile: { type: profileType },
    createClient: async () => ({}),
    lib: {
      utils: {
        printTable: () => {},
        handleError: () => {},
        addFilterOption: (c) => c,
        addSortOption: (c) => c,
        addPaginationOptions: (c) => c,
        addFormatOption: (c) => c,
        buildSearchCriteria: () => ({ params: {} }),
        formatOutput: () => false,
      },
    },
  };
}

/** Collect all command names recursively as "parent child grandchild" paths. */
function collectNames(commands, prefix = '') {
  const names = [];
  for (const cmd of commands) {
    const full = prefix ? `${prefix} ${cmd._name}` : cmd._name;
    names.push(full);
    names.push(...collectNames(cmd.commands ?? [], full));
  }
  return names;
}

function registeredNames(context) {
  return collectNames(context.program.commands);
}

// ─── Static config ────────────────────────────────────────────────────────────

describe('mage-remote-run.json', () => {
  const config = JSON.parse(
    readFileSync(new URL('../mage-remote-run.json', import.meta.url), 'utf8'),
  );

  test('is valid JSON with a commands array', () => {
    assert.ok(Array.isArray(config.commands));
    assert.ok(config.commands.length > 0);
  });

  test('every command has a name', () => {
    for (const cmd of config.commands) {
      assert.ok(typeof cmd.name === 'string' && cmd.name.length > 0, `missing name: ${JSON.stringify(cmd)}`);
    }
  });

  test('every executable command has method and endpoint', () => {
    for (const cmd of config.commands) {
      if (cmd.method) {
        assert.ok(cmd.endpoint, `${cmd.name}: has method but no endpoint`);
      }
    }
  });

  test('all names are under the amasty namespace', () => {
    for (const cmd of config.commands) {
      assert.ok(
        cmd.name === 'amasty' || cmd.name.startsWith('amasty '),
        `${cmd.name} is not under the amasty namespace`,
      );
    }
  });

  test('no duplicate command names', () => {
    const names = config.commands.map((c) => c.name);
    const seen = new Set();
    for (const name of names) {
      assert.ok(!seen.has(name), `duplicate command name: ${name}`);
      seen.add(name);
    }
  });

  test('required options have a description', () => {
    for (const cmd of config.commands) {
      for (const [key, opt] of Object.entries(cmd.options ?? {})) {
        if (opt.required) {
          assert.ok(opt.description, `${cmd.name} option ${key}: required but no description`);
        }
      }
    }
  });
});

// ─── Plugin registration ──────────────────────────────────────────────────────

describe('plugin (index.js)', () => {
  test('registers commands for supported connection types', async () => {
    for (const type of ['magento-os', 'mage-os', 'ac-on-prem', 'ac-cloud-paas', 'ac-saas']) {
      const ctx = makeContext(type);
      await plugin(ctx);
      assert.ok(registeredNames(ctx).length > 0, `no commands registered for ${type}`);
    }
  });

  test('registers no commands when profile is null', async () => {
    const ctx = makeContext();
    ctx.profile = null;
    await plugin(ctx);
    assert.equal(registeredNames(ctx).length, 0);
  });

  test('registers no commands for unsupported connection type', async () => {
    const ctx = makeContext('unknown-type');
    await plugin(ctx);
    assert.equal(registeredNames(ctx).length, 0);
  });

  test('registers all five expected JS commands', async () => {
    const ctx = makeContext();
    await plugin(ctx);
    const names = registeredNames(ctx);

    const expected = [
      'amasty quote list',
      'amasty quickorder search',
      'amasty storecredit balance',
      'amasty attachment list',
      'amasty wishlist all',
    ];

    for (const name of expected) {
      assert.ok(names.includes(name), `missing command: ${name}`);
    }
  });

  test('amasty quickorder search requires --search-term', async () => {
    const ctx = makeContext();
    await plugin(ctx);

    const amasty = ctx.program.commands.find((c) => c._name === 'amasty');
    const quickorder = amasty?.commands.find((c) => c._name === 'quickorder');
    const search = quickorder?.commands.find((c) => c._name === 'search');

    assert.ok(search, 'amasty quickorder search command not found');
    assert.ok(
      search._opts.some((f) => f.includes('search-term')),
      '--search-term option not registered',
    );
  });

  test('getOrCreate reuses existing parent commands', async () => {
    const ctx = makeContext();

    // Simulate virtual commands having already created the amasty parent
    const preCreated = makeCmd('amasty');
    ctx.program.commands.push(preCreated);

    await plugin(ctx);

    // Only one 'amasty' command should exist
    const amastyInstances = ctx.program.commands.filter((c) => c._name === 'amasty');
    assert.equal(amastyInstances.length, 1, 'duplicate amasty command created');
    assert.equal(amastyInstances[0], preCreated, 'existing amasty command was not reused');
  });
});
