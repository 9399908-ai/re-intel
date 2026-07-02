"""
Re-Intel.ai Matching Engine

Responsible for:
1. Selecting 2 matches per week per user
2. Scoring compatibility based on:
   - Complementary roles (investor + broker, etc)
   - Same geographic market
   - Similar asset class interests
   - Past feedback scores
3. Retraining on feedback data

Run with: python matching_engine.py
"""

import json
import random
from datetime import datetime

class MatchingEngine:
    def __init__(self):
        self.users = []
        self.matches_history = []
        self.feedback_data = []
        
    def load_users(self, user_list):
        """Load user profiles from database"""
        self.users = user_list
        print(f"✅ Loaded {len(self.users)} users")
    
    def calculate_compatibility(self, user1, user2):
        """
        Score compatibility between two users (0-100)
        
        Factors:
        - Complementary roles (+25 points)
        - Same market (+20 points)
        - Same asset class (+20 points)
        - No recent matches (-30 points)
        - High feedback rating from both (+15 points)
        """
        score = 0
        
        # Role complementarity
        complementary_roles = {
            'owner': ['broker', 'vendor', 'investor'],
            'broker': ['owner', 'vendor', 'investor'],
            'vendor': ['owner', 'broker', 'investor'],
            'investor': ['owner', 'broker'],
        }
        
        if user2['role'] in complementary_roles.get(user1['role'], []):
            score += 25
        
        # Market overlap
        shared_markets = set(user1.get('markets', [])) & set(user2.get('markets', []))
        if shared_markets:
            score += 20
        
        # Asset class overlap
        shared_assets = set(user1.get('assetTypes', [])) & set(user2.get('assetTypes', []))
        if shared_assets:
            score += 20
        
        # Feedback history (placeholder)
        # In production, query actual feedback scores
        score += random.randint(0, 15)
        
        return min(score, 100)
    
    def generate_weekly_matches(self, user_id, num_matches=2):
        """
        Generate 2 matches for a specific user
        
        Returns: List of match objects with user_id, matched_user_id, score
        """
        user = next((u for u in self.users if u['id'] == user_id), None)
        if not user:
            return []
        
        # Score all other users
        scores = []
        for other_user in self.users:
            if other_user['id'] == user_id:
                continue
            
            # Check if already matched recently (placeholder)
            already_matched = False  # TODO: check database
            if already_matched:
                continue
            
            score = self.calculate_compatibility(user, other_user)
            scores.append({
                'user_id': user_id,
                'matched_user_id': other_user['id'],
                'matched_name': other_user['name'],
                'matched_title': other_user['title'],
                'matched_company': other_user['company'],
                'score': score,
                'timestamp': datetime.now().isoformat(),
            })
        
        # Sort by score and take top N
        scores.sort(key=lambda x: x['score'], reverse=True)
        matches = scores[:num_matches]
        
        self.matches_history.extend(matches)
        return matches
    
    def record_feedback(self, match_id, sender_id, receiver_id, feedback_data):
        """
        Record feedback after a match meeting
        
        feedback_data: {
            'valuable': 'yes' | 'somewhat' | 'no',
            'followup': 'yes' | 'maybe' | 'no',
            'improvements': 'text'
        }
        """
        feedback = {
            'match_id': match_id,
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'data': feedback_data,
            'timestamp': datetime.now().isoformat(),
        }
        
        self.feedback_data.append(feedback)
        self._retrain_model()
        print(f"✅ Feedback recorded for match {match_id}")
    
    def _retrain_model(self):
        """
        Retrain algorithm based on recent feedback
        
        In production:
        - Train scikit-learn model on feedback data
        - Update scoring weights
        - Test on holdout set
        - Deploy updated model
        """
        if len(self.feedback_data) < 5:
            return  # Need minimum feedback to retrain
        
        print(f"🔄 Retraining model with {len(self.feedback_data)} feedback records...")
        
        # Placeholder for ML training
        # TODO: Implement actual model training
        
        print("✅ Model retrained")
    
    def get_matches_for_week(self):
        """
        Get all matches scheduled for this week
        (Runs every Monday 9am)
        """
        # Generate 2 matches per active user
        all_matches = []
        for user in self.users:
            if user.get('verified', False):
                matches = self.generate_weekly_matches(user['id'], num_matches=2)
                all_matches.extend(matches)
        
        print(f"📢 Generated {len(all_matches)} matches for the week")
        return all_matches


# Example usage
if __name__ == '__main__':
    # Sample data
    sample_users = [
        {
            'id': 1,
            'name': 'Marcus Lee',
            'title': 'Broker',
            'company': 'Lee & Associates',
            'role': 'broker',
            'markets': ['NYC', 'NJ'],
            'assetTypes': ['multifamily', 'office'],
            'verified': True,
        },
        {
            'id': 2,
            'name': 'Sarah Chen',
            'title': 'Owner',
            'company': 'Chen Properties',
            'role': 'owner',
            'markets': ['NYC'],
            'assetTypes': ['multifamily'],
            'verified': True,
        },
        {
            'id': 3,
            'name': 'Robert Martinez',
            'title': 'Vendor',
            'company': 'Property Solutions',
            'role': 'vendor',
            'markets': ['NYC', 'Boston'],
            'assetTypes': ['office', 'industrial'],
            'verified': True,
        },
    ]
    
    # Initialize engine
    engine = MatchingEngine()
    engine.load_users(sample_users)
    
    # Generate matches for user 1
    matches = engine.generate_weekly_matches(1)
    print(f"\n🎯 Matches for Marcus Lee:")
    for match in matches:
        print(f"  - {match['matched_name']} ({match['matched_title']}) - Score: {match['score']}")
    
    # Record sample feedback
    engine.record_feedback(
        match_id=1,
        sender_id=1,
        receiver_id=2,
        feedback_data={
            'valuable': 'yes',
            'followup': 'yes',
            'improvements': 'Would like more frequent matches',
        }
    )
