const MAX_MESSAGE_LENGTH = 500;

/**
 * Escape HTML/Markdown control characters globally and bound length
 * so untrusted issue comments cannot break or inject into the README table.
 */
function sanitizeText(rawText) {
  const cleaned = String(rawText ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  const truncated =
    cleaned.length > MAX_MESSAGE_LENGTH
      ? `${cleaned.slice(0, MAX_MESSAGE_LENGTH - 3)}...`
      : cleaned;

  return truncated
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\|/g, '&#124;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/`/g, '&#96;')
    .replace(/(\r\n|\r|\n)/g, '<br />');
}

function renderComments(comments) {
  return comments.reduce((prev, curr) => {
    const author = curr.author || {
      avatarUrl: 'https://github.com/ghost.png?size=48',
      login: 'ghost',
      url: 'https://github.com/ghost',
    };
    const sanitizedText = sanitizeText(curr.bodyText);
    const formattedDate = new Date(curr.updatedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    return `${prev}|[<img src="${author.avatarUrl}" alt="${author.login}" width="48" /><br />${author.login}](${author.url})|${formattedDate}<br />[Comment](${curr.url})|${sanitizedText}|\n`;
  }, '| Name | Date | Message |\n|---|---|---|\n');
}

async function updateGuestbook({ github, context }) {
  const query = `query($owner:String!, $name:String!, $issue_number:Int!) {
    repository(owner:$owner, name:$name) {
      issue(number:$issue_number) {
        comments(first:10, orderBy:{direction:DESC, field:UPDATED_AT}) {
          nodes {
            author {
              avatarUrl(size: 48)
              login
              url
            }
            url
            bodyText
            updatedAt
          }
        }
      }
    }
  }`;

  const variables = {
    owner: context.repo.owner,
    name: context.repo.repo,
    issue_number: context.issue.number,
  };

  const result = await github.graphql(query, variables);
  const nodes = result?.repository?.issue?.comments?.nodes || [];

  const fs = require('fs');
  const readme = fs.readFileSync('README.md', 'utf8');
  const updated = readme.replace(
    /(?<=<!-- Guestbook -->.*\n)[\S\s]*?(?=<!-- \/Guestbook -->|$(?![\n]))/gm,
    renderComments(nodes)
  );
  fs.writeFileSync('README.md', updated, 'utf8');
}

module.exports = updateGuestbook;
module.exports.sanitizeText = sanitizeText;
module.exports.renderComments = renderComments;
