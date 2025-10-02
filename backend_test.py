import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class DocumentationAPITester:
    def __init__(self, base_url="https://docs-platform.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, files: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if files:
            # Remove content-type for file uploads
            headers.pop('Content-Type', None)

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                self.log_test(name, False, f"Unsupported method: {method}")
                return False, {}

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            if success:
                self.log_test(name, True)
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}. Response: {response_data}")

            return success, response_data

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "admin/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_admin_verify(self):
        """Test admin token verification"""
        if not self.token:
            self.log_test("Admin Verify", False, "No token available")
            return False
        
        return self.run_test("Admin Verify", "GET", "admin/verify", 200)[0]

    def test_get_articles(self):
        """Test getting public articles"""
        return self.run_test("Get Articles (Public)", "GET", "articles", 200)

    def test_get_navigation(self):
        """Test getting navigation"""
        return self.run_test("Get Navigation", "GET", "navigation", 200)

    def test_search_functionality(self):
        """Test search functionality"""
        success1, _ = self.run_test("Search - Valid Query", "GET", "search?q=getting&limit=5", 200)
        success2, _ = self.run_test("Search - Empty Query", "GET", "search?q=", 200)
        return success1 and success2

    def test_article_crud(self):
        """Test article CRUD operations"""
        if not self.token:
            self.log_test("Article CRUD", False, "No admin token")
            return False

        # Create article
        test_article = {
            "title": "Test Article",
            "slug": "test-article-" + str(int(datetime.now().timestamp())),
            "content": [
                {
                    "type": "text",
                    "content": "<h1>Test Article</h1><p>This is a test article content.</p>"
                }
            ],
            "category": "Test Category",
            "order": 999,
            "meta_description": "Test article description",
            "keywords": ["test", "article"],
            "published": True
        }

        # Create
        success, create_response = self.run_test(
            "Create Article",
            "POST",
            "admin/articles",
            200,
            data=test_article
        )

        if not success:
            return False

        article_id = create_response.get('id')
        if not article_id:
            self.log_test("Article CRUD", False, "No article ID returned")
            return False

        # Read specific article
        success, _ = self.run_test(
            "Get Article by Slug",
            "GET",
            f"articles/{test_article['slug']}",
            200
        )

        if not success:
            return False

        # Update
        update_data = {
            "title": "Updated Test Article",
            "meta_description": "Updated description"
        }

        success, _ = self.run_test(
            "Update Article",
            "PUT",
            f"admin/articles/{article_id}",
            200,
            data=update_data
        )

        if not success:
            return False

        # Delete
        success, _ = self.run_test(
            "Delete Article",
            "DELETE",
            f"admin/articles/{article_id}",
            200
        )

        return success

    def test_navigation_crud(self):
        """Test navigation CRUD operations"""
        if not self.token:
            self.log_test("Navigation CRUD", False, "No admin token")
            return False

        # Create navigation item
        test_nav = {
            "label": "Test Navigation",
            "type": "category",
            "target": None,
            "parent_id": None,
            "order": 999,
            "icon": "test-icon"
        }

        # Create
        success, create_response = self.run_test(
            "Create Navigation Item",
            "POST",
            "admin/navigation",
            200,
            data=test_nav
        )

        if not success:
            return False

        nav_id = create_response.get('id')
        if not nav_id:
            self.log_test("Navigation CRUD", False, "No navigation ID returned")
            return False

        # Update
        update_data = {
            "label": "Updated Test Navigation",
            "type": "category",
            "target": None,
            "parent_id": None,
            "order": 999,
            "icon": "updated-icon"
        }

        success, _ = self.run_test(
            "Update Navigation Item",
            "PUT",
            f"admin/navigation/{nav_id}",
            200,
            data=update_data
        )

        if not success:
            return False

        # Delete
        success, _ = self.run_test(
            "Delete Navigation Item",
            "DELETE",
            f"admin/navigation/{nav_id}",
            200
        )

        return success

    def test_invalid_login(self):
        """Test invalid login credentials"""
        return self.run_test(
            "Invalid Login",
            "POST",
            "admin/login",
            401,
            data={"username": "wrong", "password": "wrong"}
        )[0]

    def test_unauthorized_access(self):
        """Test unauthorized access to admin endpoints"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success, _ = self.run_test(
            "Unauthorized Article Creation",
            "POST",
            "admin/articles",
            401,
            data={"title": "Test", "slug": "test", "content": [], "category": "Test"}
        )
        
        # Restore token
        self.token = original_token
        return success

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Emergent Documentation API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        # Basic connectivity
        self.test_health_check()
        
        # Public endpoints
        self.test_get_articles()
        self.test_get_navigation()
        self.test_search_functionality()
        
        # Authentication
        self.test_invalid_login()
        login_success = self.test_admin_login()
        
        if login_success:
            self.test_admin_verify()
            self.test_unauthorized_access()
            
            # Admin operations
            self.test_article_crud()
            self.test_navigation_crud()
        else:
            print("⚠️  Skipping admin tests due to login failure")

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            return 1

    def get_test_summary(self):
        """Get test summary for reporting"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "test_results": self.test_results
        }

def main():
    tester = DocumentationAPITester()
    exit_code = tester.run_all_tests()
    
    # Save detailed results
    summary = tester.get_test_summary()
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())