/*
 * Copyright 2015 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

import registerSuite from 'intern!object';
import assert from 'intern/chai!assert';
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import ClustersPage from 'tests/functional/pages/clusters';
import ModalWindow from 'tests/functional/pages/modal';
import DashboardPage from 'tests/functional/pages/dashboard';
import NetworkPage from 'tests/functional/pages/network';

registerSuite(function() {
  var common,
    clusterPage,
    dashboardPage,
    networkPage;
  var applyButtonSelector = '.apply-btn';
  return {
    name: 'Networks page Neutron tests',
    setup: function() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      networkPage = new NetworkPage(this.remote);
      return this.remote
        .then(function() {
          return common.getIn();
        })
        .then(function() {
          return common.createCluster(
            'Test Cluster #1',
            {
              'Networking Setup': function() {
                return this.remote
                  .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:vlan]')
                  .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:tun]');
              }
            }
          );
        })
        .then(function() {
          return clusterPage.goToTab('Networks');
        });
    },
    afterEach: function() {
      return this.remote
        .findByCssSelector('.btn-revert-changes')
          .then(function(element) {
            return element.isEnabled()
              .then(function(isEnabled) {
                if (isEnabled) return element.click();
              });
          })
          .end();
    },
    'Network Tab is rendered correctly': function() {
      var self = this;
      return this.remote
        .assertElementsExist('.network-tab h3', 4, 'All networks are present')
        .getCurrentUrl()
          .then(function(url) {
            assert.include(
              url,
              'network/group/1',
              'Subtab url exists in the page location string'
            );
          })
        .assertElementsExist('.popover-container i', 'Networking info icons presented')
        .findByCssSelector('.public .popover-container i')
          .then(function(element) {
            return self.remote.moveMouseTo(element);
          })
          .end()
        .assertElementAppears('.requirements-popover', 1000, 'Networking help popover is shown')
        .clickLinkByText('Neutron L2')
        .getCurrentUrl()
          .then(function(url) {
            assert.include(url, 'neutron_l2', 'Networks tab subtabs are routable');
          })
        .findByCssSelector('ul.node_network_groups')
          .clickLinkByText('default')
          .end();
    },
    'Testing cluster networks: Save button interactions': function() {
      var self = this;
      var cidrInitialValue;
      var cidrElementSelector = '.storage input[name=cidr]';
      return this.remote
        .findByCssSelector(cidrElementSelector)
        .then(function(element) {
          return element.getProperty('value')
            .then(function(value) {
              cidrInitialValue = value;
            });
        })
        .end()
        .setInputValue(cidrElementSelector, '240.0.1.0/25')
        .assertElementAppears(applyButtonSelector + ':not(:disabled)', 200,
          'Save changes button is enabled if there are changes')
        .then(function() {
          return self.remote.setInputValue(cidrElementSelector, cidrInitialValue);
        })
        .assertElementAppears(applyButtonSelector + ':disabled', 200,
          'Save changes button is disabled again if there are no changes');
    },
    'Testing cluster networks: network notation change': function() {
      return this.remote
        .then(function() {
          return networkPage.goToNodeNetworkGroup('default');
        })
        .assertElementAppears('.storage', 2000, 'Storage network is shown')
        .assertElementSelected('.storage .cidr input[type=checkbox]',
          'Storage network has "cidr" notation by default')
        .assertElementNotExists('.storage .ip_ranges input[type=text]:not(:disabled)',
          'It is impossible to configure IP ranges for network with "cidr" notation')
        .clickByCssSelector('.storage .cidr input[type=checkbox]')
        .assertElementNotExists('.storage .ip_ranges input[type=text]:disabled',
          'Network notation was changed to "ip_ranges"');
    },
    'Testing cluster networks: save network changes': function() {
      var cidrElementSelector = '.storage .cidr input[type=text]';
      return this.remote
        .setInputValue(cidrElementSelector, '192.168.1.0/26')
        .clickByCssSelector(applyButtonSelector)
        .assertElementsAppear('input:not(:disabled)', 2000, 'Inputs are not disabled')
        .assertElementNotExists('.alert-error', 'Correct settings were saved successfully')
        .assertElementDisabled(applyButtonSelector,
          'Save changes button is disabled again after successful settings saving');
    },
    'Testing cluster networks: verification': function() {
      this.timeout = 100000;
      return this.remote
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementDisabled('.verify-networks-btn',
          'Verification button is disabled in case of no nodes')
        .assertElementTextEquals('.alert-warning',
          'At least two online nodes are required to verify environment network configuration',
          'Not enough nodes warning is shown')
        .then(function() {
          return networkPage.goToNodeNetworkGroup('default');
        })
        .then(function() {
          // Adding 2 controllers
          return common.addNodesToCluster(2, ['Controller']);
        })
        .then(function() {
          return clusterPage.goToTab('Networks');
        })
        .setInputValue('.public input[name=gateway]', '172.16.0.2')
        .clickByCssSelector('.subtab-link-network_verification')
        .clickByCssSelector('.verify-networks-btn')
        .assertElementAppears('.alert-danger.network-alert', 4000, 'Verification error is shown')
        .assertElementAppears('.alert-danger.network-alert', 'Address intersection',
          'Verification result is shown in case of address intersection')
        // Testing cluster networks: verification task deletion
        .then(function() {
          return networkPage.goToNodeNetworkGroup('default');
        })
        .setInputValue('.public input[name=gateway]', '172.16.0.5')
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementNotExists('.page-control-box .alert',
          'Verification task was removed after settings has been changed')
        .clickByCssSelector('.btn-revert-changes')
        .clickByCssSelector('.verify-networks-btn')
        .waitForElementDeletion('.animation-box .success.connect-1', 6000)
        .assertElementAppears('.alert-success', 10000, 'Success verification message appears')
        .assertElementContainsText(
          '.alert-success',
          'Verification succeeded',
          'Success verification message appears with proper text'
        )
        .then(function() {
          return clusterPage.goToTab('Dashboard');
        })
        .then(function() {
          return dashboardPage.discardChanges();
        })
        .then(function() {
          return clusterPage.goToTab('Networks');
        });
    },
    'Check VlanID field validation': function() {
      return this.remote
        .then(function() {
          return networkPage.goToNodeNetworkGroup('default');
        })
        .assertElementAppears('.management', 2000, 'Management network appears')
        .clickByCssSelector('.management .vlan-tagging input[type=checkbox]')
        .clickByCssSelector('.management .vlan-tagging input[type=checkbox]')
        .assertElementExists('.management .has-error input[name=vlan_start]',
          'Field validation has worked properly in case of empty value');
    },
    'Testing cluster networks: data validation on invalid settings': function() {
      return this.remote
        .then(function() {
          return networkPage.goToNodeNetworkGroup('default');
        })
        .setInputValue('.public input[name=cidr]', 'blablabla')
        .assertElementAppears('.public .has-error input[name=cidr]', 1000,
          'Error class style is applied to invalid input field')
        .assertElementsExist(
          '#network-subtabs i.glyphicon-danger-sign',
          2,
          'Warning tab icons appear for public network and floating ranges setting')
        .assertElementExists('.add-nodegroup-btn .glyphicon-danger-sign', 1000,
          'Warning icon for Add Node Network Group appears')
        .clickByCssSelector('.btn-revert-changes')
        .waitForElementDeletion('.alert-danger.network-alert', 1000)
        .assertElementNotExists('#network-subtabs i.glyphicon-danger-sign',
          'Warning tab icon disappears')
        .assertElementNotExists('.public .has-error input[name=cidr]', 1000,
          'Error class style is removed after reverting changes')
        .assertElementNotExists('.add-nodegroup-btn .glyphicon-danger-sign', 1000,
          'Warning icon for Add Node Network Group disappears');
    },
    'Add ranges manipulations': function() {
      var rangeSelector = '.public .ip_ranges ';
      return this.remote
        .clickByCssSelector(rangeSelector + '.ip-ranges-add')
        .assertElementsExist(rangeSelector + '.ip-ranges-delete', 2,
          'Remove ranges controls appear')
        .clickByCssSelector(applyButtonSelector)
        .assertElementsExist(rangeSelector + '.range-row',
          'Empty range row is removed after saving changes')
        .assertElementNotExists(rangeSelector + '.ip-ranges-delete',
          'Remove button is absent for only one range');
    },
    'Segmentation types differences': function() {
      return this.remote
        .then(function() {
          return networkPage.goToNodeNetworkGroup('default');
        })
        // Tunneling segmentation tests
        .assertElementExists('.private',
          'Private Network is visible for tunneling segmentation type')
        .assertElementTextEquals('.segmentation-type', '(Neutron with tunneling segmentation)',
          'Segmentation type is correct for tunneling segmentation')
        // Vlan segmentation tests
        .clickLinkByText('Environments')
        .then(function() {
          return common.createCluster('Test vlan segmentation');
        })
        .then(function() {
          return clusterPage.goToTab('Networks');
        })
        .assertElementNotExists('.private',
          'Private Network is not visible for vlan segmentation type')
        .assertElementTextEquals('.segmentation-type', '(Neutron with VLAN segmentation)',
          'Segmentation type is correct for VLAN segmentation');
    },
    'Other settings validation error': function() {
      return this.remote
        .clickByCssSelector('.subtab-link-network_settings')
        .setInputValue('input[name=dns_list]', 'blablabla')
        .assertElementAppears('.subtab-link-network_settings .glyphicon-danger-sign', 2000,
          'Warning icon for "Other" section appears');
    }
  };
});

registerSuite(function() {
  var common,
    clusterPage,
    modal,
    networkPage,
    clustersPage;

  return {
    name: 'Node network group tests',
    setup: function() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      modal = new ModalWindow(this.remote);
      networkPage = new NetworkPage(this.remote);
      clustersPage = new ClustersPage(this.remote);

      return this.remote
        .then(function() {
          return common.getIn();
        })
        .then(function() {
          return clustersPage.goToEnvironment('Test vlan segmentation');
        })
        .then(function() {
          return clusterPage.goToTab('Networks');
        });
    },
    'Node network group creation': function() {
      return this.remote
        .clickByCssSelector('.add-nodegroup-btn')
        .then(function() {
          return modal.waitToOpen();
        })
        .assertElementContainsText('h4.modal-title', 'Add New Node Network Group',
          'Add New Node Network Group modal expected')
        .setInputValue('[name=node-network-group-name]', 'Node_Network_Group_1')
        .then(function() {
          return modal.clickFooterButton('Add Group');
        })
        .then(function() {
          return modal.waitToClose();
        })
        .assertElementDisappears(
          '.network-group-name .explanation',
          5000,
          'New subtab is shown'
        )
        .assertElementTextEquals(
          '.network-group-name .btn-link',
          'Node_Network_Group_1',
          'New Node Network group title is shown'
        );
    },
    'Show all networks': function() {
      return this.remote
        .clickByCssSelector('.show-all-networks')
        .waitForCssSelector('.networks li.active.all', 2000)
        .assertElementTextEquals(
          '.networks li.active',
          'All Networks',
          'Active pill is called "All Networks"'
        )
        .assertElementsExist(
          '.network-group-name',
          2,
          'Two node network group titles are shown'
        )
        .assertElementsExist('.forms-box.public', 2, 'Two Public networks are shown')
        .assertElementsExist('.forms-box.storage', 2, 'Two Storage networks are shown')
        .assertElementsExist('.forms-box.management', 2, 'Two Management networks are shown')
        .getCurrentUrl()
          .then(function(url) {
            assert.include(
              url,
              'network/group/all',
              'Subtab url is changed after clicking  "Show All Networks"'
            );
          })
        .assertElementSelected(
          '.show-all-networks',
          'Show All Networks checkbox is checked'
        )
        .then(function() {
          return networkPage.addNodeNetworkGroup('temp');
        })
        .getCurrentUrl()
          .then(function(url) {
            assert.include(
              url,
              'network/group/all',
              'Subtab url is not changed after adding new node network group'
            );
          })
        .clickByCssSelector('.subtab-link-neutron_l3')
        .waitForCssSelector('.nav-pills.networks li.all', 1000)
        .assertElementTextEquals(
          '.nav-pills.networks li.all',
          'All Networks',
          'Navigation pill text is not changed when switching to neutron_l3 tab'
        )
        .clickByCssSelector('.subtab-link-all')
        .waitForCssSelector('.network-group-name', 2000)
        .then(function() {
          return networkPage.removeNodeNetworkGroup('temp');
        })
        .then(function() {
          return networkPage.removeNodeNetworkGroup('Node_Network_Group_1');
        })
        .setInputValue('.storage .cidr input[type=text]', '192.168.1.0/')
        .assertElementAppears('.storage .has-error input[name=cidr]', 1000,
          'Error class style is applied to invalid input field in "Show All Networks" mode')
        .clickByCssSelector('.btn-revert-changes')
        .then(function() {
          return networkPage.addNodeNetworkGroup('Node_Network_Group_1');
        })
        .clickLinkByText('default')
        .assertElementsExist(
          '.node_network_groups li',
          3,
          'Title and Node Network groups pills are shown after clicking "Show all networks"'
        )
        .assertElementsExist('.forms-box.public', 1, 'One Public network is shown')
        .assertElementsExist('.forms-box.storage', 1, 'One Storage network is shown')
        .assertElementsExist('.forms-box.management', 1, 'One Management network is shown')
        .getCurrentUrl()
          .then(function(url) {
            assert.include(
              url,
              'network/group/2',
              'Subtab url is changed after clicking  "Show Node Network Groups"'
            );
          });
    },
    'Verification is disabled for multirack': function() {
      return this.remote
        .clickByCssSelector('.subtab-link-network_verification')
        .assertElementExists('.alert-warning', 'Warning is shown')
        .assertElementDisabled('.verify-networks-btn', 'Verify networks button is disabled');
    },
    'Node network group renaming': function() {
      this.timeout = 100000;
      return this.remote
        .clickLinkByText('Node_Network_Group_1')
        .then(function() {
          return networkPage.renameNodeNetworkGroup(
            'Node_Network_Group_1',
            'Node_Network_Group_2'
          );
        })
        .assertElementTextEquals(
          '.nav-pills.node_network_groups li:last-child',
          'Node_Network_Group_2',
          'Node network group was successfully renamed'
        )
        .clickLinkByText('Environments')
        .then(function() {
          return clustersPage.goToEnvironment('Test Cluster #1');
        })
        .then(function() {
          return clusterPage.goToTab('Networks');
        })
        .then(function() {
          return networkPage.addNodeNetworkGroup('new_1');
        })
        .clickLinkByText('Environments')
        .then(function() {
          return clustersPage.goToEnvironment('Test vlan segmentation');
        })
        .then(function() {
          return clusterPage.goToTab('Networks');
        })
        .then(function() {
          return networkPage.addNodeNetworkGroup('new_1');
        })
        .then(function() {
          return networkPage.goToNodeNetworkGroup('default');
        })
        .then(function() {
          return networkPage.renameNodeNetworkGroup('default', 'new');
        })
        .then(function() {
          return networkPage.renameNodeNetworkGroup('new', 'default');
        })
        .assertElementContainsText(
          '.network-group-name .btn-link', 'default',
          'Node network group was successfully renamed to "default"'
        );
    },
    'Node network group deletion': function() {
      return this.remote
        .then(function() {
          return networkPage.goToNodeNetworkGroup('default');
        })
        .assertElementDisappears(
          '.glyphicon-remove',
          3000,
          'It is not possible to delete default node network group'
        )
        .clickLinkByText('Node_Network_Group_2')
        .assertElementAppears('.glyphicon-remove', 1000, 'Remove icon is shown')
        .clickByCssSelector('.glyphicon-remove')
        .then(function() {
          return modal.waitToOpen();
        })
        .assertElementContainsText('h4.modal-title', 'Remove Node Network Group',
          'Remove Node Network Group modal expected')
        .then(function() {
          return modal.clickFooterButton('Delete');
        })
        .then(function() {
          return modal.waitToClose();
        })
        .assertElementAppears(
          '.network-group-name .explanation',
          3000,
          'Node network group was successfully removed'
        );
    },
    'Node network group renaming in deployed environment': function() {
      this.timeout = 100000;
      return this.remote
        .then(function() {
          return common.addNodesToCluster(1, ['Controller']);
        })
        .then(function() {
          return clusterPage.deployEnvironment();
        })
        .then(function() {
          return clusterPage.goToTab('Networks');
        })
        .then(function() {
          return networkPage.goToNodeNetworkGroup('default');
        })
        .assertElementExists(
          '.glyphicon-pencil',
          'Renaming of a node network group is not fobidden in deployed environment'
        );
    }
  };
});
