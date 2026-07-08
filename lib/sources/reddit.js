// lib/sources/reddit.js
// جلب مشاعر المستثمرين من Reddit

export async function fetchRedditSentiment() {
  try {
    const subreddits = ['stocks', 'investing', 'wallstreetbets', 'ValueInvesting'];
    const results = {};
    
    for (const sub of subreddits) {
      const url = `https://www.reddit.com/r/${sub}/hot.json?limit=50`;
      
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        
        if (!response.ok) continue;
        const data = await response.json();
        
        const posts = data.data?.children || [];
        const mentions = {};
        let totalScore = 0;
        
        for (const post of posts) {
          const title = post.data?.title || '';
          const score = post.data?.score || 0;
          totalScore += score;
          
          // استخراج رموز الأسهم من العناوين
          const symbols = title.match(/\$([A-Z]{1,5})/g) || [];
          for (const sym of symbols) {
            const clean = sym.replace('$', '');
            if (!mentions[clean]) mentions[clean] = 0;
            mentions[clean] += score;
          }
        }
        
        // ترتيب الأسهم حسب الأكثر ذكراً
        const sorted = Object.entries(mentions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([symbol, score]) => ({ symbol, score }));
        
        results[sub] = sorted;
      } catch (e) {
        // تخطي الأخطاء
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ Reddit error:', error);
    return {};
  }
}
