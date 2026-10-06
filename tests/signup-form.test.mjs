import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const pagePath = fileURLToPath(new URL('../index.html', import.meta.url));

function xpath(expression) {
    return execFileSync('xmllint', ['--html', '--xpath', expression, pagePath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, received ${actual}`);
    }
}

try {
    assertEqual(
        xpath("count(//form[@class='signup-form' and @action='https://bandtools.app/u/faroutbound/subscribers' and @method='post' and @target=//iframe/@name])"),
        '1',
        'signup form should submit to Bandtools in its response iframe',
    );
    assertEqual(
        xpath("count(//form[@class='signup-form']//input[@type='hidden' and @name='source' and @value='embedded'])"),
        '1',
        'signup form should identify the embedded source',
    );
    assertEqual(
        xpath("count(//form[@class='signup-form']//input[@type='email' and @name='subscriber[email_address]' and @required])"),
        '1',
        'signup form should require a subscriber email address',
    );
    assertEqual(
        xpath("count(//form[@class='signup-form']//input[@type='text' and @name='website'])"),
        '1',
        'signup form should retain the spam honeypot',
    );
    assertEqual(
        xpath("count(//form[@class='signup-form']//a[contains(., 'Bandtools')])"),
        '0',
        'signup form should not display vendor branding',
    );
    console.log('ok - signup form preserves the Bandtools subscription contract without vendor branding');
} catch (error) {
    console.error('not ok - signup form preserves the Bandtools subscription contract without vendor branding');
    console.error(error);
    process.exitCode = 1;
}
