/* ME.Coach self-discovery tests. Original items written for ME.Coach, inspired by widely used public models
 * (DISC, Jungian 16 types, Big Five, Enneagram, Holland RIASEC, Schwartz values, five conflict modes, emotional intelligence).
 * They are reflection tools, not clinical or hiring assessments. MBTI is a trademark of the Myers-Briggs Company; this is not the MBTI.
 * Areas: Career, Money, Health, Family, Relationships, Personal growth, Fun & recreation, Home & environment.
 */
window.MEC_TESTS = (function () {
  const L5 = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
  const tests = {};

  /* ---------- DISC ---------- */
  tests.disc = {
    id: 'disc', name: 'DISC style', short: 'How you act and communicate', cat: 'Personality', mins: 6, color: '#eb6834', icon: '◆', scale: L5, kind: 'likert',
    about: 'DISC describes four behaviour styles: Dominance, Influence, Steadiness and Conscientiousness. Everyone uses all four; most people lead with one or two.',
    items: [
      ['I like to take charge when a group is stuck.', 'D'], ['I make decisions quickly, even with incomplete information.', 'D'], ['I enjoy competition and winning.', 'D'], ['I say what I think directly.', 'D'], ['I get impatient when things move slowly.', 'D'], ['I like big challenges more than routine work.', 'D'],
      ['I easily start conversations with new people.', 'I'], ['I like to inspire and energise others.', 'I'], ['People say I am optimistic and enthusiastic.', 'I'], ['I prefer talking ideas through rather than writing them down.', 'I'], ['I enjoy being in the spotlight.', 'I'], ['I persuade people with stories and emotion.', 'I'],
      ['I am patient and a good listener.', 'S'], ['I prefer a stable, predictable routine.', 'S'], ['I put the harmony of the team first.', 'S'], ['I am loyal and reliable once I commit.', 'S'], ['Sudden changes make me uncomfortable.', 'S'], ['I like helping people behind the scenes.', 'S'],
      ['I check details carefully before I finish.', 'C'], ['I like clear rules and high standards.', 'C'], ['I want data before I decide.', 'C'], ['I prefer to plan carefully rather than improvise.', 'C'], ['Mistakes in my work bother me a lot.', 'C'], ['I ask many questions to understand how things work.', 'C']
    ],
    keys: ['D', 'I', 'S', 'C'],
    results: {
      D: { name: 'Dominance', nick: 'The Driver', summary: 'You are direct, decisive and results-driven. You see the goal, take charge and move fast.', strengths: ['Decisive under pressure', 'Takes ownership', 'Turns problems into action', 'Comfortable with challenge'], watch: ['Can seem blunt or impatient', 'May skip details and people’s feelings', 'Can take on too much alone'], work: 'You do your best work with clear goals, authority to decide, and room to move quickly. Short meetings and visible results energise you.', talk: 'Be brief and direct with me. Start with the bottom line, give me options, and let me decide.', stress: 'Under stress you may become controlling. Pause, ask one question, and listen to the answer before acting.', micro: [['Relationships', 'Before your next reply, ask one question and listen fully.'], ['Health', 'Take a 5-minute walk between two meetings today.'], ['Career', 'Write down the one result that matters most this week.']] },
      I: { name: 'Influence', nick: 'The Inspirer', summary: 'You are outgoing, enthusiastic and persuasive. You connect people and bring energy to any room.', strengths: ['Builds relationships fast', 'Motivates others', 'Creative and optimistic', 'Great at selling ideas'], watch: ['Can overcommit', 'May lose focus on follow-through', 'Can avoid hard details'], work: 'You thrive in collaborative, people-rich work with recognition and variety. Pair yourself with a detail-minded partner.', talk: 'Be warm and friendly with me. Share the big picture and the people side first; follow up in writing.', stress: 'Under stress you may talk more and finish less. Pick one task and complete it before starting another.', micro: [['Career', 'Finish one open task before starting a new one.'], ['Money', 'Check yesterday’s spending for 2 minutes.'], ['Personal growth', 'Write 3 lines about what you learned today.']] },
      S: { name: 'Steadiness', nick: 'The Supporter', summary: 'You are calm, patient and dependable. People trust you and teams feel safe around you.', strengths: ['Loyal and consistent', 'Excellent listener', 'Keeps teams together', 'Finishes what is started'], watch: ['Can resist change', 'May avoid conflict too long', 'Can say yes when you mean no'], work: 'You do your best work in a stable team with clear expectations, time to adjust and sincere appreciation.', talk: 'Be patient and sincere with me. Explain the why behind changes and give me time to process.', stress: 'Under stress you may go quiet and absorb too much. Name one thing you need and ask for it.', micro: [['Relationships', 'Say one honest “no” or “not now” this week.'], ['Personal growth', 'Try one small new thing today: a new route, food or tool.'], ['Health', 'Take three slow breaths before your next meeting.']] },
      C: { name: 'Conscientiousness', nick: 'The Analyst', summary: 'You are precise, thoughtful and quality-focused. You want to get it right and understand how things work.', strengths: ['High standards', 'Logical and accurate', 'Plans carefully', 'Spots risks early'], watch: ['Can over-analyse', 'May be self-critical', 'Can seem distant'], work: 'You do your best work with clear standards, time to think, data, and fewer interruptions.', talk: 'Be precise and prepared with me. Bring facts, give me time to think, and put it in writing.', stress: 'Under stress you may seek more data instead of deciding. Set a decision deadline and accept “good enough”.', micro: [['Career', 'Set a 25-minute limit for one task and ship it.'], ['Fun & recreation', 'Do one fun thing today with no goal at all.'], ['Relationships', 'Share one feeling, not just a fact, with someone close.']] }
    },
    others: {
      D: 'With a D: get to the point, focus on results, offer choices, don’t take bluntness personally.',
      I: 'With an I: be friendly, allow small talk, share ideas visually, recognise their contribution publicly.',
      S: 'With an S: be patient, explain changes early, show appreciation, ask for their opinion one-to-one.',
      C: 'With a C: be accurate, bring data, avoid surprises, give time and written detail.'
    }
  };

  /* ---------- 16 types (Jungian preferences) ---------- */
  tests.types = {
    id: 'types', name: '16 Types', short: 'Your Jungian personality type (MBTI-style)', cat: 'Personality', mins: 8, color: '#6250d6', icon: '◈', kind: 'pair',
    about: 'Based on Carl Jung’s ideas: where you get energy (E/I), how you take in information (S/N), how you decide (T/F) and how you organise life (J/P). This is an independent MBTI-style questionnaire, not the official MBTI.',
    items: [
      ['After a busy week I recharge by…', 'going out with friends', 'quiet time on my own', 'EI'], ['In a group I usually…', 'speak up early', 'listen first, speak later', 'EI'], ['I think best…', 'out loud, talking it through', 'in my head, before I speak', 'EI'], ['At a party I…', 'meet many new people', 'talk deeply with one or two', 'EI'], ['I prefer work that is…', 'full of people and action', 'focused and independent', 'EI'], ['People see me as…', 'outgoing', 'reserved', 'EI'], ['A free Saturday ideally is…', 'social plans', 'my own projects', 'EI'], ['I share my news…', 'right away with many people', 'later with a few people', 'EI'],
      ['I trust more…', 'facts and experience', 'patterns and possibilities', 'SN'], ['I prefer instructions that are…', 'step by step and concrete', 'the big idea, I fill the gaps', 'SN'], ['I notice first…', 'details and what is real now', 'meanings and what could be', 'SN'], ['I enjoy…', 'improving what already works', 'imagining something new', 'SN'], ['When I describe something I…', 'am literal and specific', 'use metaphors and ideas', 'SN'], ['I am more interested in…', 'what is', 'what might be', 'SN'], ['I learn best by…', 'doing and practising', 'understanding the theory', 'SN'], ['I value more…', 'common sense', 'insight and vision', 'SN'],
      ['When I decide I mostly use…', 'logic and objective criteria', 'values and how people feel', 'TF'], ['In feedback I prefer to be…', 'honest even if it stings', 'tactful and kind', 'TF'], ['I am more convinced by…', 'a strong argument', 'a strong personal story', 'TF'], ['In a conflict I focus on…', 'what is fair and true', 'keeping the relationship', 'TF'], ['People see me as…', 'rational', 'warm', 'TF'], ['A good leader is first…', 'competent', 'caring', 'TF'], ['I would rather be…', 'right', 'liked', 'TF'], ['I notice more…', 'flaws in an argument', 'how someone is feeling', 'TF'],
      ['I like my days to be…', 'planned', 'flexible', 'JP'], ['Deadlines for me are…', 'something to finish early', 'a useful last-minute push', 'JP'], ['I feel better when things are…', 'decided and settled', 'open with options', 'JP'], ['My workspace is usually…', 'organised', 'creative chaos', 'JP'], ['On a trip I prefer…', 'a clear itinerary', 'deciding as I go', 'JP'], ['I make lists and…', 'follow them', 'often ignore them', 'JP'], ['Surprises in my schedule are…', 'stressful', 'exciting', 'JP'], ['I start…', 'after I have a plan', 'and figure it out on the way', 'JP']
    ],
    letters: {
      E: ['Extraversion', 'You gain energy from people and action. You think by talking and like variety.'], I: ['Introversion', 'You gain energy from quiet reflection. You think before you speak and prefer depth over breadth.'],
      S: ['Sensing', 'You trust facts, experience and details. You are practical and grounded in the present.'], N: ['Intuition', 'You look for patterns, meaning and possibilities. You enjoy ideas and the future.'],
      T: ['Thinking', 'You decide with logic and consistency. You value fairness and truth.'], F: ['Feeling', 'You decide with values and empathy. You value harmony and people.'],
      J: ['Judging', 'You like structure, plans and closure. You finish early and keep order.'], P: ['Perceiving', 'You like flexibility and options. You adapt fast and keep things open.']
    },
    names: { ISTJ: 'The Inspector', ISFJ: 'The Protector', INFJ: 'The Counsellor', INTJ: 'The Architect', ISTP: 'The Craftsperson', ISFP: 'The Artist', INFP: 'The Idealist', INTP: 'The Thinker', ESTP: 'The Doer', ESFP: 'The Performer', ENFP: 'The Champion', ENTP: 'The Inventor', ESTJ: 'The Organiser', ESFJ: 'The Host', ENFJ: 'The Mentor', ENTJ: 'The Commander' },
    tips: {
      E: 'Talk your plan through with someone, then block quiet time to execute.', I: 'Protect recharge time in your calendar; prepare notes before meetings.',
      S: 'Break big goals into concrete weekly steps you can see.', N: 'Write your vision, then force one concrete next step for it.',
      T: 'Remember to ask how people feel before you fix the problem.', F: 'Add one objective criterion to each big decision.',
      J: 'Leave one unplanned block a week for spontaneity.', P: 'Use a short daily Top 3 to finish what you start.'
    },
    others: { E: 'With extraverts: talk it out, respond quickly, keep energy up.', I: 'With introverts: send the agenda first, give time to think, talk one-to-one.', S: 'With sensors: be concrete, give examples and steps.', N: 'With intuitives: start with the big picture and the why.', T: 'With thinkers: be logical, skip the fluff, welcome debate.', F: 'With feelers: show care, recognise effort, mind the tone.', J: 'With judgers: agree plans and deadlines, avoid last-minute changes.', P: 'With perceivers: keep options open, allow flexibility, set light checkpoints.' }
  };

  /* ---------- Big Five ---------- */
  tests.big5 = {
    id: 'big5', name: 'Big Five', short: 'The five core traits psychology uses', cat: 'Personality', mins: 6, color: '#2a78d6', icon: '✦', scale: L5, kind: 'likert',
    about: 'The Big Five (OCEAN) is the most researched trait model: Openness, Conscientiousness, Extraversion, Agreeableness and Emotional stability. Scores are percentages of the scale, not comparisons with other people.',
    items: [
      ['I am full of new ideas.', 'O'], ['I enjoy art, music or beautiful things.', 'O'], ['I am curious about many different things.', 'O'], ['I prefer what I know over new experiences.', 'O', 1], ['I enjoy thinking about abstract ideas.', 'O'],
      ['I get my tasks done on time.', 'Co'], ['I keep my things in order.', 'Co'], ['I follow through on my plans.', 'Co'], ['I often leave things to the last minute.', 'Co', 1], ['I pay attention to details.', 'Co'],
      ['I feel comfortable around people.', 'Ex'], ['I start conversations.', 'Ex'], ['I am the life of the party.', 'Ex'], ['I prefer to stay in the background.', 'Ex', 1], ['I have a lot of energy around others.', 'Ex'],
      ['I care about how others feel.', 'A'], ['I like to help people.', 'A'], ['I trust people easily.', 'A'], ['I can be critical and harsh.', 'A', 1], ['I make people feel at ease.', 'A'],
      ['I stay calm under pressure.', 'N'], ['I rarely feel anxious.', 'N'], ['My mood changes a lot.', 'N', 1], ['I worry about things.', 'N', 1], ['I recover quickly after setbacks.', 'N']
    ],
    keys: ['O', 'Co', 'Ex', 'A', 'N'],
    traits: {
      O: ['Openness', 'Curious, creative, open to new experiences.', 'Practical, prefers the familiar and proven.', ['Personal growth', 'Learn one new idea today: a 10-minute article or video.']],
      Co: ['Conscientiousness', 'Organised, reliable, goal-driven.', 'Flexible and spontaneous, may struggle with routines.', ['Career', 'Pick a Top 3 for tomorrow before you sleep.']],
      Ex: ['Extraversion', 'Sociable, energetic, talkative.', 'Reserved, reflective, enjoys solitude.', ['Relationships', 'Send one message to someone you miss.']],
      A: ['Agreeableness', 'Warm, cooperative, trusting.', 'Direct, competitive, sceptical.', ['Family', 'Give one sincere compliment to a family member.']],
      N: ['Emotional stability', 'Calm, resilient, even-tempered.', 'Sensitive to stress, feels emotions strongly.', ['Health', 'Do a 2-minute breathing exercise in Calm.']]
    }
  };

  /* ---------- Enneagram ---------- */
  tests.ennea = {
    id: 'ennea', name: 'Enneagram', short: 'Your core motivation and fear', cat: 'Personality', mins: 7, color: '#e87ba4', icon: '✺', scale: L5, kind: 'likert',
    about: 'The Enneagram describes nine types by what drives you underneath your behaviour. Use your top result as a mirror, not a box.',
    items: [
      ['I notice what is wrong and want to fix it.', '1'], ['I hold myself to very high standards.', '1'], ['Doing things the right way matters deeply to me.', '1'],
      ['I naturally sense what others need.', '2'], ['I feel good when people need me.', '2'], ['I find it hard to ask for help for myself.', '2'],
      ['Achieving and being successful drives me.', '3'], ['I care how others see my results.', '3'], ['I adapt to win in different situations.', '3'],
      ['I feel different from most people.', '4'], ['I want my life to be meaningful and authentic.', '4'], ['I feel emotions deeply and intensely.', '4'],
      ['I need time alone to think and understand.', '5'], ['I collect knowledge before I act.', '5'], ['I protect my energy and privacy.', '5'],
      ['I think about what could go wrong.', '6'], ['Loyalty and security are very important to me.', '6'], ['I look for people and systems I can trust.', '6'],
      ['I love new experiences and plans.', '7'], ['I avoid feeling stuck or bored.', '7'], ['I see the bright side quickly.', '7'],
      ['I like to be in control of my life.', '8'], ['I protect people who are weaker.', '8'], ['I am comfortable with confrontation.', '8'],
      ['I keep the peace and avoid conflict.', '9'], ['I easily see every side of an issue.', '9'], ['I sometimes forget my own priorities.', '9']
    ],
    keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    results: {
      1: ['The Reformer', 'Driven to improve and do what is right.', 'Being wrong or corrupt.', 'Relax standards for one thing today and notice that the world is fine.', 'Personal growth'],
      2: ['The Helper', 'Driven to be loved and to help.', 'Being unwanted.', 'Ask for one small thing for yourself today.', 'Relationships'],
      3: ['The Achiever', 'Driven to succeed and be valued.', 'Being worthless without results.', 'Spend 20 minutes on something with no audience.', 'Fun & recreation'],
      4: ['The Individualist', 'Driven to be authentic and unique.', 'Having no identity or significance.', 'Turn one feeling into a small action today.', 'Personal growth'],
      5: ['The Investigator', 'Driven to understand and be capable.', 'Being helpless or incompetent.', 'Share an idea before it feels finished.', 'Career'],
      6: ['The Loyalist', 'Driven to feel safe and supported.', 'Being without support.', 'Write down one thing that went right today.', 'Health'],
      7: ['The Enthusiast', 'Driven to be happy and free.', 'Being trapped in pain or limits.', 'Stay with one task for 25 minutes without switching.', 'Career'],
      8: ['The Challenger', 'Driven to be strong and in control.', 'Being controlled or harmed.', 'Show one soft side to someone you trust.', 'Family'],
      9: ['The Peacemaker', 'Driven to keep inner and outer peace.', 'Conflict and separation.', 'Say what you want first in one decision today.', 'Relationships']
    }
  };

  /* ---------- RIASEC career interests ---------- */
  tests.riasec = {
    id: 'riasec', name: 'Career interests', short: 'Holland code (RIASEC)', cat: 'Career', mins: 6, color: '#1baf7a', icon: '⬢', scale: ['Dislike', 'Slightly dislike', 'Unsure', 'Slightly enjoy', 'Enjoy'], kind: 'likert',
    about: 'John Holland’s six interest types: Realistic, Investigative, Artistic, Social, Enterprising and Conventional. Your top three letters form your career code. It feeds the Career explorer.',
    items: [
      ['Fixing or building things with my hands', 'R'], ['Working outdoors', 'R'], ['Operating tools, machines or equipment', 'R'], ['Setting up hardware or technical systems', 'R'], ['Physical, active work', 'R'],
      ['Solving complex problems', 'I'], ['Doing research and analysis', 'I'], ['Understanding how things work', 'I'], ['Working with data and numbers to find insights', 'I'], ['Learning science or technology', 'I'],
      ['Designing visuals, spaces or products', 'A'], ['Writing stories, posts or scripts', 'A'], ['Creating music, photos or video', 'A'], ['Coming up with original ideas', 'A'], ['Work with freedom to express myself', 'A'],
      ['Teaching or training people', 'S'], ['Helping people with their problems', 'S'], ['Coaching or mentoring', 'S'], ['Caring for people’s health or wellbeing', 'S'], ['Working in a team toward a shared cause', 'S'],
      ['Leading a team or project', 'E'], ['Selling or persuading', 'E'], ['Starting a business', 'E'], ['Negotiating deals', 'E'], ['Taking risks for big rewards', 'E'],
      ['Organising files, schedules or records', 'C'], ['Working with spreadsheets and procedures', 'C'], ['Checking work for accuracy', 'C'], ['Managing budgets', 'C'], ['Following clear processes', 'C']
    ],
    keys: ['R', 'I', 'A', 'S', 'E', 'C'],
    results: {
      R: ['Realistic', 'The Maker', 'Hands-on, practical, likes tangible results.', 'Engineering, construction, operations, technical trades'],
      I: ['Investigative', 'The Thinker', 'Analytical, curious, likes ideas and evidence.', 'Data, research, IT, science, analysis'],
      A: ['Artistic', 'The Creator', 'Expressive, original, likes freedom.', 'Design, content, media, architecture, marketing creative'],
      S: ['Social', 'The Helper', 'Supportive, empathetic, likes people growth.', 'Teaching, coaching, health, HR, community'],
      E: ['Enterprising', 'The Persuader', 'Ambitious, energetic, likes leading and selling.', 'Management, sales, business, entrepreneurship, consulting'],
      C: ['Conventional', 'The Organiser', 'Orderly, precise, likes structure.', 'Finance, administration, project control, compliance']
    }
  };

  /* ---------- Values ---------- */
  tests.values = {
    id: 'values', name: 'Core values', short: 'What matters most to you', cat: 'Purpose', mins: 5, color: '#c9a227', icon: '❖', scale: ['Not important', 'Slightly', 'Important', 'Very important', 'Essential'], kind: 'likert',
    about: 'Ten universal values from Shalom Schwartz’s research. Knowing your top three helps you choose goals that feel right and decide faster.',
    items: [
      ['Making my own choices and thinking freely', 'SD'], ['Being creative and independent', 'SD'], ['Excitement, novelty and challenge', 'ST'], ['An adventurous, varied life', 'ST'], ['Enjoying life and its pleasures', 'HE'], ['Having fun and treating myself', 'HE'],
      ['Being successful and admired for my skills', 'AC'], ['Ambition and reaching high goals', 'AC'], ['Wealth, status and influence', 'PO'], ['Being in charge and having authority', 'PO'], ['Safety and stability for me and my family', 'SE'], ['A secure, orderly life', 'SE'],
      ['Good manners and following rules', 'CO'], ['Not upsetting others', 'CO'], ['Faith and respecting traditions', 'TR'], ['Humility and modesty', 'TR'], ['Caring for the people close to me', 'BE'], ['Being loyal and dependable to friends and family', 'BE'],
      ['Justice and equality for everyone', 'UN'], ['Protecting nature and the world', 'UN']
    ],
    keys: ['SD', 'ST', 'HE', 'AC', 'PO', 'SE', 'CO', 'TR', 'BE', 'UN'],
    results: {
      SD: ['Self-direction', 'Freedom to think and choose', 'Personal growth'], ST: ['Stimulation', 'Novelty and challenge', 'Fun & recreation'], HE: ['Enjoyment', 'Pleasure and joy in life', 'Fun & recreation'],
      AC: ['Achievement', 'Success through competence', 'Career'], PO: ['Influence', 'Status, resources and leadership', 'Money'], SE: ['Security', 'Safety and stability', 'Home & environment'],
      CO: ['Harmony', 'Respect, rules and restraint', 'Relationships'], TR: ['Faith and tradition', 'Faith, culture and humility', 'Personal growth'], BE: ['Care', 'Caring for the people close to you', 'Family'], UN: ['Fairness', 'Justice, tolerance and nature', 'Relationships']
    }
  };

  /* ---------- Conflict style ---------- */
  tests.conflict = {
    id: 'conflict', name: 'Conflict style', short: 'How you handle disagreement', cat: 'Relationships', mins: 4, color: '#e34948', icon: '⇄', scale: L5, kind: 'likert',
    about: 'Five common ways to handle conflict, based on how much you focus on your own goals and on the relationship. Every style is useful in the right moment.',
    items: [
      ['I stand firm to get my point across.', 'CP'], ['I argue my case to win.', 'CP'], ['I push for my solution when I believe in it.', 'CP'],
      ['I look for a solution that fully satisfies both sides.', 'CL'], ['I put all concerns on the table to solve them together.', 'CL'], ['I take time to understand the other side’s real needs.', 'CL'],
      ['I look for a middle ground quickly.', 'CM'], ['I give a little to get a little.', 'CM'], ['Splitting the difference seems fair to me.', 'CM'],
      ['I avoid arguments when I can.', 'AV'], ['I postpone difficult conversations.', 'AV'], ['I keep my opinion to myself to stay out of trouble.', 'AV'],
      ['I go along with others to keep the peace.', 'AC'], ['I give up my position to protect the relationship.', 'AC'], ['I put the other person’s needs first.', 'AC']
    ],
    keys: ['CP', 'CL', 'CM', 'AV', 'AC'],
    results: {
      CP: ['Competing', 'Assertive and focused on your goal.', 'Great for emergencies and firm decisions. Overused, it damages trust.', 'In your next disagreement, ask “what matters most to you here?” first.'],
      CL: ['Collaborating', 'Assertive and cooperative: win–win.', 'Great for important issues with long-term relationships. It takes time.', 'Save deep collaboration for big issues; decide small ones quickly.'],
      CM: ['Compromising', 'Middle ground, fast and fair.', 'Great under time pressure. Overused, nobody gets what they really need.', 'Before splitting the difference, check if a better option exists.'],
      AV: ['Avoiding', 'Stepping back from the conflict.', 'Useful when emotions are high or the issue is small. Overused, problems grow.', 'Write down one issue you are avoiding and schedule a 10-minute talk.'],
      AC: ['Accommodating', 'Yielding to keep the relationship.', 'Useful when the issue matters more to the other person. Overused, resentment builds.', 'Say your own preference once before you agree.']
    }
  };

  /* ---------- Emotional intelligence ---------- */
  tests.eq = {
    id: 'eq', name: 'Emotional intelligence', short: 'Five EQ skills you can train', cat: 'Relationships', mins: 5, color: '#008300', icon: '❤', scale: L5, kind: 'likert',
    about: 'Based on Daniel Goleman’s five areas of emotional intelligence. Every area is a skill that improves with practice.',
    items: [
      ['I can name what I feel while I feel it.', 'SA'], ['I know what triggers my bad moods.', 'SA'], ['I understand how my emotions affect my work.', 'SA'], ['I know my strengths and limits.', 'SA'],
      ['I stay calm when I am criticised.', 'SR'], ['I think before I react when I am angry.', 'SR'], ['I can calm myself down after stress.', 'SR'], ['I keep my promises even when I do not feel like it.', 'SR'],
      ['I keep going after setbacks.', 'MO'], ['I set goals that stretch me.', 'MO'], ['I find meaning in what I do.', 'MO'], ['I stay positive when things go wrong.', 'MO'],
      ['I notice how others feel, even when they don’t say it.', 'EM'], ['I listen without planning my answer.', 'EM'], ['I can see things from another person’s view.', 'EM'], ['People open up to me.', 'EM'],
      ['I handle conflict in a constructive way.', 'SS'], ['I give feedback without hurting people.', 'SS'], ['I build rapport quickly.', 'SS'], ['I can influence people without pressure.', 'SS']
    ],
    keys: ['SA', 'SR', 'MO', 'EM', 'SS'],
    results: {
      SA: ['Self-awareness', 'Knowing your emotions and their effects.', 'Name your feeling in one word three times today.', 'Personal growth'],
      SR: ['Self-regulation', 'Managing impulses and staying calm.', 'When triggered, wait 6 seconds and take one breath before you reply.', 'Health'],
      MO: ['Motivation', 'Inner drive toward goals.', 'Write why your main goal matters to you in one sentence.', 'Career'],
      EM: ['Empathy', 'Sensing others’ feelings and needs.', 'In one conversation today, reflect back what you heard before you answer.', 'Relationships'],
      SS: ['Social skills', 'Managing relationships and influence.', 'Thank one person today for something specific.', 'Family']
    }
  };

  /* ---------- Energy & stress check ---------- */
  tests.energy = {
    id: 'energy', name: 'Energy & stress check', short: 'A 2-minute wellbeing check', cat: 'Wellbeing', mins: 2, color: '#008300', icon: '⚡', scale: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'], kind: 'likert',
    about: 'A short self-check of energy, sleep, stress and recovery over the last two weeks. It is not a medical test. If you feel unwell for a long time, talk to a doctor or a professional.',
    items: [['I wake up rested.', 'EN'], ['I have energy for what matters to me.', 'EN'], ['I sleep 7 hours or more.', 'EN'], ['I move my body most days.', 'EN'], ['I feel overwhelmed by what I have to do.', 'EN', 1], ['I find it hard to switch off after work.', 'EN', 1], ['I feel irritable or tense.', 'EN', 1], ['I take real breaks during the day.', 'EN'], ['I have someone to talk to when things are hard.', 'EN'], ['I feel in control of my week.', 'EN']],
    keys: ['EN'],
    levels: [[0, 'Running low', 'Your energy is low right now. Choose rest first: protect sleep, cut one commitment this week, and use Calm daily.'], [45, 'Holding on', 'You are coping, with some strain. Add recovery on purpose: one real break a day and one evening fully off.'], [70, 'Charged', 'Your energy is in a good place. Keep the habits that work and plan your recovery before busy weeks.']]
  };

  const ORDER = ['disc', 'types', 'big5', 'ennea', 'riasec', 'values', 'conflict', 'eq', 'energy'];

  /* ---------- scoring ---------- */
  function score(id, answers) {
    const t = tests[id], out = { test: id, raw: {}, pct: {} };
    if (t.kind === 'pair') {
      const c = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
      t.items.forEach((it, i) => { const v = answers[i]; if (v === 0) c[it[3][0]]++; else if (v === 1) c[it[3][1]]++; });
      const pick = (a, b) => (c[a] >= c[b] ? a : b);
      out.type = pick('E', 'I') + pick('S', 'N') + pick('T', 'F') + pick('J', 'P');
      ['EI', 'SN', 'TF', 'JP'].forEach(d => { const n = c[d[0]] + c[d[1]] || 1; out.pct[d] = Math.round(100 * c[d[0]] / n); });
      out.raw = c; out.top = [out.type]; return out;
    }
    const sum = {}, max = {};
    t.items.forEach((it, i) => { const k = it[1], v = answers[i]; if (v == null) return; const s = it[2] ? 4 - v : v; sum[k] = (sum[k] || 0) + s; max[k] = (max[k] || 0) + 4; });
    t.keys.forEach(k => { out.raw[k] = sum[k] || 0; out.pct[k] = max[k] ? Math.round(100 * (sum[k] || 0) / max[k]) : 0; });
    out.top = t.keys.slice().sort((a, b) => out.pct[b] - out.pct[a]);
    return out;
  }

  /* ---------- the result view model ---------- */
  function report(id, r) {
    const t = tests[id], R = { title: '', tag: '', summary: '', blocks: [], micro: [], others: [], chips: [] };
    if (id === 'disc') {
      const a = t.results[r.top[0]], b = t.results[r.top[1]];
      R.title = `${a.nick} · ${r.top[0]}${r.pct[r.top[1]] >= r.pct[r.top[0]] - 10 ? '/' + r.top[1] : ''}`; R.tag = a.name; R.summary = a.summary + (r.pct[r.top[1]] >= r.pct[r.top[0]] - 10 ? ` You also show strong ${b.name.toLowerCase()}: ${b.summary.split('.')[0].toLowerCase()}.` : '');
      R.blocks.push(['Your strengths', a.strengths], ['Watch out for', a.watch], ['How you work best', [a.work]], ['How to talk to you', [a.talk]], ['Under stress', [a.stress]]);
      R.others = t.keys.map(k => [t.results[k].name, t.others[k]]); R.micro = a.micro; R.chips = [r.top[0] + (r.top[1] ? '/' + r.top[1] : '')];
    } else if (id === 'types') {
      const ty = r.type; R.title = `${ty} · ${t.names[ty]}`; R.tag = ty.split('').map(l => t.letters[l][0]).join(' · ');
      R.summary = ty.split('').map(l => t.letters[l][1]).join(' ');
      R.blocks.push(['Growth tips', ty.split('').map(l => t.tips[l])]);
      R.others = ['EI', 'SN', 'TF', 'JP'].flatMap(d => [[t.letters[d[0]][0], t.others[d[0]]], [t.letters[d[1]][0], t.others[d[1]]]]);
      R.micro = [['Personal growth', t.tips[ty[0]]], ['Career', t.tips[ty[2]]], ['Home & environment', t.tips[ty[3]]]]; R.chips = [ty];
    } else if (id === 'big5') {
      R.title = 'Your Big Five profile'; R.tag = 'OCEAN';
      R.summary = t.keys.map(k => `${t.traits[k][0]} ${r.pct[k]}%`).join(' · ');
      R.blocks.push(['What it means', t.keys.map(k => `${t.traits[k][0]}: ${r.pct[k] >= 55 ? t.traits[k][1] : t.traits[k][2]}`)]);
      R.micro = r.top.slice().reverse().slice(0, 3).map(k => t.traits[k][3]); R.chips = r.top.slice(0, 2).map(k => t.traits[k][0]);
    } else if (id === 'ennea') {
      const k = r.top[0], x = t.results[k], w = [String((+k + 7) % 9 + 1), String(+k % 9 + 1)].sort((a, b) => r.pct[b] - r.pct[a])[0];
      R.title = `Type ${k}w${w} · ${x[0]}`; R.tag = 'Enneagram'; R.summary = `${x[1]} Core fear: ${x[2].toLowerCase()} Your wing ${w} (${t.results[w][0]}) adds its colour.`;
      R.blocks.push(['Your next growth step', [x[3]]], ['Also strong for you', r.top.slice(1, 3).map(j => `${j} · ${t.results[j][0]}: ${t.results[j][1]}`)]);
      R.micro = [[x[4], x[3]]]; R.chips = [`${k}w${w}`];
    } else if (id === 'riasec') {
      const code = r.top.slice(0, 3).join(''); R.title = `Code ${code}`; R.tag = r.top.slice(0, 3).map(k => t.results[k][0]).join(' · ');
      R.summary = r.top.slice(0, 3).map(k => `${t.results[k][1]}: ${t.results[k][2]}`).join(' ');
      R.blocks.push(['Fields that fit', r.top.slice(0, 3).map(k => `${t.results[k][0]}: ${t.results[k][3]}`)]);
      R.micro = [['Career', 'Open the Career explorer and save one career that fits your code.'], ['Personal growth', 'Find one 30-minute course in your top field.']]; R.chips = [code]; R.code = code;
    } else if (id === 'values') {
      const top = r.top.slice(0, 3); R.title = top.map(k => t.results[k][0]).join(' · '); R.tag = 'Your top 3 values';
      R.summary = top.map(k => `${t.results[k][0]} (${t.results[k][1].toLowerCase()})`).join(', ') + '. Use them to test every big goal: does it serve at least one of these?';
      R.blocks.push(['Least important right now', r.top.slice(-2).map(k => t.results[k][0])]);
      R.micro = top.map(k => [t.results[k][2], `Do one thing today that expresses ${t.results[k][0].toLowerCase()}.`]); R.chips = top.map(k => t.results[k][0]);
    } else if (id === 'conflict') {
      const x = t.results[r.top[0]]; R.title = x[0]; R.tag = 'Your go-to conflict style'; R.summary = `${x[1]} ${x[2]}`;
      R.blocks.push(['Next time try', [x[3]]], ['Your backup style', [t.results[r.top[1]][0] + ': ' + t.results[r.top[1]][1]]]);
      R.others = t.keys.map(k => [t.results[k][0], t.results[k][2]]); R.micro = [['Relationships', x[3]]]; R.chips = [x[0]];
    } else if (id === 'eq') {
      const lo = r.top.slice(-2), hi = r.top[0]; R.title = `Strongest: ${t.results[hi][0]}`; R.tag = 'Emotional intelligence';
      R.summary = t.keys.map(k => `${t.results[k][0]} ${r.pct[k]}%`).join(' · ');
      R.blocks.push(['Train next', lo.map(k => `${t.results[k][0]}: ${t.results[k][1]}`)]);
      R.micro = lo.map(k => [t.results[k][3], t.results[k][2]]); R.chips = ['EQ ' + Math.round(t.keys.reduce((s, k) => s + r.pct[k], 0) / t.keys.length) + '%'];
    } else if (id === 'energy') {
      const p = r.pct.EN, lv = t.levels.filter(l => p >= l[0]).pop(); R.title = `${lv[1]} · ${p}%`; R.tag = 'Energy & stress'; R.summary = lv[2];
      R.micro = [['Health', 'Go to bed 20 minutes earlier tonight.'], ['Health', 'Take a 2-minute breathing break at 3 pm.']]; R.chips = [lv[1]];
    }
    return R;
  }
  return { tests, order: ORDER, score, report, areas: ['Career', 'Money', 'Health', 'Family', 'Relationships', 'Personal growth', 'Fun & recreation', 'Home & environment'] };
})();
